import { authenticateRequest, AuthError, deriveSessionId } from './access';
import { createRequestLogger } from './logger';
import { generateAssistantReply, UpstreamError } from './openai';
import { getDefaultPromptProfileId, getPromptProfile, getPromptProfilesForClient } from './prompts';
import { enforceRespondRateLimit } from './rateLimit';
import {
  errorResponse,
  handleOptions,
  isOriginAllowed,
  jsonResponse,
  noContentResponse,
  redirectResponse
} from './security';
import type { ChatAdminUsageResponse, ChatMemoryMode, ChatRespondResponse, ChatSessionResponse, Env } from './types';
import { getDefaultMemoryMode, isMemoryModeAvailable } from './memoryModes';
import {
  buildUseCaseLockClearCookie,
  buildUseCaseLockSetCookie,
  createUseCaseLockToken,
  parseCookie,
  USE_CASE_LOCK_COOKIE,
  verifyUseCaseLockToken
} from './useCaseLock';
import { getUsageSummary, hasUsageDb, recordUsageEvent } from './usageStore';
import { validateResetPayload, validateRespondPayload, ValidationError } from './validation';
import { applyBaseTruthDiff } from './memory/diff';
import { withSessionMemoryLock } from './memory/locks';
import { buildTieredChatSystemPrompt } from './memory/prompts/chatContext';
import {
  appendSessionRawExchange,
  appendSessionTurnSummary,
  clearSessionMemory,
  evictExpiredSessions,
  getOrCreateSessionMemory,
  setSessionBaseTruth
} from './memory/store';
import { summarizeTurn } from './memory/summarizer';
import { getRuntimeConfig, type RuntimeConfig } from './runtimeConfig';

interface WorkerExecutionContext {
  waitUntil?(promise: Promise<unknown>): void;
}

const badRoute = (origin: string | null, env: Env, requestId: string): Response => {
  return errorResponse(origin, env, 404, 'NOT_FOUND', 'Route not found.', requestId);
};

const ensureAllowedOrigin = (origin: string | null, env: Env): void => {
  if (!isOriginAllowed(origin, env)) {
    throw new AuthError('Origin not allowed.', 403, 'FORBIDDEN');
  }
};

const toSessionResponse = (
  sessionId: string,
  username: string,
  controlCenterEnabled: boolean,
  exp: number,
  limits: RuntimeConfig['limits'],
  memoryModes: Array<{ id: ChatMemoryMode; display_name: string }>,
  selectedUseCaseId: string | null,
  selectedMemoryMode: ChatMemoryMode | null,
  useCaseLocked: boolean
): ChatSessionResponse => ({
  ok: true,
  session_id: sessionId,
  user: {
    username
  },
  capabilities: {
    control_center: controlCenterEnabled
  },
  selected_use_case_id: selectedUseCaseId,
  selected_memory_mode: selectedMemoryMode,
  use_case_locked: useCaseLocked,
  memory_modes: memoryModes,
  prompt_profiles: getPromptProfilesForClient(),
  expires_at: new Date(exp * 1000).toISOString(),
  limits: {
    max_turns: limits.maxTurns,
    max_user_chars: limits.maxUserChars,
    max_context_messages: limits.maxContextMessages
  }
});

const subjectPrefix = (subject: string): string => subject.slice(0, 8);

const emailDomain = (email: string): string => {
  const parts = email.split('@');
  return parts[1] || 'unknown';
};

const parseAllowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const countUserTurns = (messages: Array<{ role: 'user' | 'assistant' }>): number => {
  return messages.filter((message) => message.role === 'user').length;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const readPositiveInt = (value: string | null, fallback: number, min: number, max: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const getDefaultReturnTo = (env: Env): string => {
  const firstAllowedOrigin = parseAllowedOrigins(env)[0];
  if (!firstAllowedOrigin) return '/';
  return `${firstAllowedOrigin}/#/chat`;
};

const getSafeReturnTo = (url: URL, env: Env): string => {
  const fallback = getDefaultReturnTo(env);
  const rawReturnTo = url.searchParams.get('return_to')?.trim();

  if (!rawReturnTo) return fallback;

  try {
    const candidate = new URL(rawReturnTo);
    const allowedOrigins = new Set(parseAllowedOrigins(env));

    if (!allowedOrigins.has(candidate.origin.toLowerCase())) {
      return fallback;
    }

    return candidate.toString();
  } catch {
    return fallback;
  }
};

export default {
  async fetch(request: Request, env: Env, ctx?: WorkerExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const requestId = crypto.randomUUID();
    const logger = createRequestLogger(env, {
      requestId,
      method: request.method,
      path: url.pathname
    });

    logger.info('request.received', {
      origin_present: Boolean(origin),
      user_agent: request.headers.get('User-Agent') || 'unknown'
    });

    try {
      if (request.method === 'OPTIONS') {
        logger.debug('request.preflight');
        return handleOptions(request, env);
      }

      ensureAllowedOrigin(origin, env);
      const runtimeConfig = getRuntimeConfig(env);

      if (url.pathname === '/api/chat/login' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        const returnTo = getSafeReturnTo(url, env);

        logger.info('chat.login.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          email_domain: emailDomain(auth.email),
          duration_ms: Date.now() - startedAt
        });

        return redirectResponse(origin, env, returnTo, 302);
      }

      if (url.pathname === '/api/chat/session' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        const sessionId = await deriveSessionId(auth, env);
        const nowEpochSeconds = Math.floor(Date.now() / 1000);
        const lockToken = parseCookie(request, USE_CASE_LOCK_COOKIE);
        const verifiedLock = lockToken
          ? await verifyUseCaseLockToken(env, lockToken, sessionId, nowEpochSeconds)
          : null;
        const selectedProfile = verifiedLock ? getPromptProfile(verifiedLock.useCaseId, env) : null;
        const selectedUseCaseId = selectedProfile?.id || null;
        const selectedMemoryMode = verifiedLock?.memoryMode || null;
        const useCaseLocked = Boolean(verifiedLock);

        logger.info('chat.session.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          email_domain: emailDomain(auth.email),
          use_case_locked: useCaseLocked,
          use_case_id: selectedUseCaseId,
          duration_ms: Date.now() - startedAt
        });

        return jsonResponse(
          origin,
          env,
          toSessionResponse(
            sessionId,
            auth.identity.username,
            auth.identity.role === 'admin',
            auth.claims.exp,
            runtimeConfig.limits,
            runtimeConfig.memoryModes,
            selectedUseCaseId,
            selectedMemoryMode,
            useCaseLocked
          ),
          200
        );
      }

      if (url.pathname === '/api/chat/admin/usage' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (auth.identity.role !== 'admin') {
          throw new AuthError('Admin access required.', 403, 'FORBIDDEN');
        }

        if (!hasUsageDb(env)) {
          logger.error('admin.usage.unavailable', {
            user_id: auth.identity.user_id,
            duration_ms: Date.now() - startedAt
          });
          return errorResponse(origin, env, 503, 'USAGE_STORAGE_UNAVAILABLE', 'Usage storage unavailable.', requestId);
        }

        const windowDays = readPositiveInt(url.searchParams.get('days'), 7, 1, 365);
        const maxUsers = readPositiveInt(url.searchParams.get('limit'), 25, 1, 100);

        let summary: ChatAdminUsageResponse;
        try {
          summary = await getUsageSummary(env, {
            windowDays,
            maxUsers
          });
        } catch (error) {
          logger.error('admin.usage.query_failed', {
            user_id: auth.identity.user_id,
            reason: error instanceof Error ? error.message : 'unknown',
            duration_ms: Date.now() - startedAt
          });
          return errorResponse(origin, env, 503, 'USAGE_STORAGE_UNAVAILABLE', 'Usage storage unavailable.', requestId);
        }

        logger.info('admin.usage.read.success', {
          user_id: auth.identity.user_id,
          window_days: summary.window_days,
          users_returned: summary.users.length,
          duration_ms: Date.now() - startedAt
        });

        return jsonResponse(origin, env, summary, 200);
      }

      if (url.pathname === '/api/chat/respond' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        await enforceRespondRateLimit(auth, env);
        const expectedSessionId = await deriveSessionId(auth, env);

        let requestBody: unknown;
        try {
          requestBody = await request.json();
        } catch {
          throw new ValidationError('Malformed JSON body.');
        }

        const payload = validateRespondPayload(requestBody, {
          maxUserChars: runtimeConfig.limits.maxUserChars,
          maxContextMessages: runtimeConfig.limits.maxContextMessages,
          maxContextChars: runtimeConfig.limits.maxContextChars,
          maxTurns: runtimeConfig.limits.maxTurns
        });

        if (payload.session_id !== expectedSessionId) {
          throw new AuthError('Session mismatch.', 403, 'FORBIDDEN');
        }

        const nowEpochSeconds = Math.floor(Date.now() / 1000);
        const userTurnCount = countUserTurns(payload.messages);
        const isFirstTurn = userTurnCount === 1;
        const suppliedLockToken = payload.use_case_lock_token || parseCookie(request, USE_CASE_LOCK_COOKIE);
        const verifiedLock = suppliedLockToken
          ? await verifyUseCaseLockToken(env, suppliedLockToken, expectedSessionId, nowEpochSeconds)
          : null;

        let resolvedUseCaseId: string;
        let resolvedMemoryMode: ChatMemoryMode;
        let useCaseLockToken: string;
        let responseSetCookie: string | null = null;
        let promptProfile = null as ReturnType<typeof getPromptProfile>;

        if (verifiedLock) {
          const lockedProfile = getPromptProfile(verifiedLock.useCaseId, env);
          if (!lockedProfile) {
            throw new ValidationError('Unknown use_case_id.');
          }

          resolvedUseCaseId = lockedProfile.id;
          resolvedMemoryMode = verifiedLock.memoryMode;
          useCaseLockToken = suppliedLockToken as string;
          promptProfile = lockedProfile;

          if (payload.use_case_id) {
            const requestedProfile = getPromptProfile(payload.use_case_id, env);
            if (!requestedProfile) {
              throw new ValidationError('Unknown use_case_id.');
            }

            if (requestedProfile.id !== resolvedUseCaseId) {
              throw new ValidationError('use_case_id is locked for this session.');
            }
          }

          if (payload.memory_mode && payload.memory_mode !== resolvedMemoryMode) {
            throw new ValidationError('memory_mode is locked for this session.');
          }
        } else {
          if (!isFirstTurn) {
            throw new ValidationError('Missing or invalid use_case_lock_token. Start a new session.');
          }

          const requestedUseCaseId = payload.use_case_id || getDefaultPromptProfileId();
          const requestedProfile = getPromptProfile(requestedUseCaseId, env);
          if (!requestedProfile) {
            throw new ValidationError('Unknown use_case_id.');
          }

          resolvedUseCaseId = requestedProfile.id;
          resolvedMemoryMode = payload.memory_mode || getDefaultMemoryMode();
          promptProfile = requestedProfile;

          useCaseLockToken = await createUseCaseLockToken(
            env,
            expectedSessionId,
            resolvedUseCaseId,
            resolvedMemoryMode,
            auth.claims.exp
          );
          const maxAgeSeconds = Math.max(1, auth.claims.exp - nowEpochSeconds);
          responseSetCookie = buildUseCaseLockSetCookie(useCaseLockToken, maxAgeSeconds);
        }

        if (!promptProfile) {
          throw new ValidationError('Unknown use_case_id.');
        }

        if (!isMemoryModeAvailable(resolvedMemoryMode, runtimeConfig.memory.enabled)) {
          throw new ValidationError('Tiered memory mode is disabled.');
        }

        const isTieredMemoryActive = runtimeConfig.memory.enabled && resolvedMemoryMode === 'tiered';
        if (isTieredMemoryActive) {
          evictExpiredSessions(Date.now());
        }

        let messagesForModel = payload.messages;
        let systemPromptForModel = promptProfile.systemPrompt;
        let sessionMemory = null;

        if (isTieredMemoryActive) {
          sessionMemory = getOrCreateSessionMemory({
            sessionId: expectedSessionId,
            userId: auth.identity.user_id,
            expiresAtMs: auth.claims.exp * 1000,
            limits: runtimeConfig.memory.storeLimits
          });

          const latestUser = payload.messages[payload.messages.length - 1];
          messagesForModel = [
            ...sessionMemory.rawWindow.map((message) => ({
              role: message.role,
              content: message.content,
              ts: message.ts
            })),
            latestUser
          ];
          systemPromptForModel = buildTieredChatSystemPrompt(promptProfile.systemPrompt, sessionMemory);
        }

        const assistant = await generateAssistantReply(env, messagesForModel, {
          systemPrompt: systemPromptForModel,
          model: runtimeConfig.ai.chat.model,
          temperature: runtimeConfig.ai.chat.temperature,
          maxContextMessages: runtimeConfig.limits.maxContextMessages,
          maxOutputTokens: runtimeConfig.ai.chat.maxOutputTokens,
          timeoutMs: runtimeConfig.ai.chat.timeoutMs
        });

        const response: ChatRespondResponse = {
          ok: true,
          assistant_message: {
            role: 'assistant',
            content: assistant.content,
            ts: new Date().toISOString()
          },
          usage: assistant.usage,
          session: {
            session_id: expectedSessionId,
            expires_at: new Date(auth.claims.exp * 1000).toISOString(),
            use_case_id: resolvedUseCaseId,
            memory_mode: resolvedMemoryMode,
            use_case_locked: true,
            use_case_lock_token: useCaseLockToken
          }
        };

        logger.info('chat.respond.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          email_domain: emailDomain(auth.email),
          user_id: auth.identity.user_id,
          use_case_id: resolvedUseCaseId,
          memory_mode: resolvedMemoryMode,
          model: response.usage?.model,
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
          duration_ms: Date.now() - startedAt
        });

        if (isTieredMemoryActive) {
          const latestUser = payload.messages[payload.messages.length - 1];
          const updateMemory = async () => {
            await withSessionMemoryLock(expectedSessionId, auth.identity.user_id, async () => {
              const state = getOrCreateSessionMemory({
                sessionId: expectedSessionId,
                userId: auth.identity.user_id,
                expiresAtMs: auth.claims.exp * 1000,
                limits: runtimeConfig.memory.storeLimits
              });

              const summary = await summarizeTurn(env, {
                userMessage: latestUser.content,
                assistantMessage: assistant.content,
                baseTruth: state.baseTruth,
                model: runtimeConfig.ai.summarizer.model,
                temperature: runtimeConfig.ai.summarizer.temperature,
                timeoutMs: runtimeConfig.ai.summarizer.timeoutMs,
                maxOutputTokens: runtimeConfig.ai.summarizer.maxOutputTokens,
                maxSummaryChars: runtimeConfig.memory.storeLimits.maxSummaryChars,
                systemPromptOverride: runtimeConfig.ai.summarizer.systemPromptOverride
              });

              const diffApplied = applyBaseTruthDiff(state.baseTruth, summary.diff, {
                maxBaseTruthEntries: runtimeConfig.memory.storeLimits.maxBaseTruthEntries,
                maxFactChars: runtimeConfig.memory.storeLimits.maxFactChars
              });

              setSessionBaseTruth(state, diffApplied.nextBaseTruth, runtimeConfig.memory.storeLimits);
              appendSessionTurnSummary(
                state,
                {
                  userSummary: summary.userSummary,
                  assistantSummary: summary.assistantSummary,
                  ts: response.assistant_message.ts
                },
                runtimeConfig.memory.storeLimits
              );
              appendSessionRawExchange(
                state,
                {
                  userMessage: latestUser.content,
                  assistantMessage: assistant.content,
                  userTs: latestUser.ts,
                  assistantTs: response.assistant_message.ts
                },
                runtimeConfig.memory.storeLimits
              );

              logger.info('memory.turn.updated', {
                user_id: auth.identity.user_id,
                mode: summary.mode,
                complexity: summary.complexity,
                base_truth_entries: state.baseTruth.length,
                turn_log_entries: state.turnLog.length,
                raw_window_messages: state.rawWindow.length
              });
            });
          };

          if (ctx?.waitUntil) {
            ctx.waitUntil(
              updateMemory().catch((error) => {
                logger.warn('memory.turn.update_failed', {
                  user_id: auth.identity.user_id,
                  reason: error instanceof Error ? error.message : 'unknown'
                });
              })
            );
          } else {
            try {
              await updateMemory();
            } catch (error) {
              logger.warn('memory.turn.update_failed', {
                user_id: auth.identity.user_id,
                reason: error instanceof Error ? error.message : 'unknown'
              });
            }
          }
        }

        if (hasUsageDb(env)) {
          try {
            await recordUsageEvent(env, {
              requestId,
              userId: auth.identity.user_id,
              username: auth.identity.username,
              useCaseId: resolvedUseCaseId,
              memoryMode: resolvedMemoryMode,
              model: response.usage?.model || runtimeConfig.ai.chat.model,
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0,
              eventTs: new Date().toISOString()
            });
          } catch (error) {
            logger.warn('chat.respond.usage_write_failed', {
              user_id: auth.identity.user_id,
              reason: error instanceof Error ? error.message : 'unknown'
            });
          }
        }

        return jsonResponse(origin, env, response, 200, responseSetCookie ? { 'Set-Cookie': responseSetCookie } : undefined);
      }

      if (url.pathname === '/api/chat/reset' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        const expectedSessionId = await deriveSessionId(auth, env);

        let requestBody: unknown;
        try {
          requestBody = await request.json();
        } catch {
          throw new ValidationError('Malformed JSON body.');
        }

        const payload = validateResetPayload(requestBody);
        if (payload.sessionId !== expectedSessionId) {
          throw new AuthError('Session mismatch.', 403, 'FORBIDDEN');
        }

        clearSessionMemory(expectedSessionId, auth.identity.user_id);

        logger.info('chat.reset.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          duration_ms: Date.now() - startedAt
        });

        return noContentResponse(origin, env, { 'Set-Cookie': buildUseCaseLockClearCookie() });
      }

      logger.warn('request.not_found', {
        duration_ms: Date.now() - startedAt
      });
      return badRoute(origin, env, requestId);
    } catch (error) {
      if (error instanceof AuthError) {
        logger.warn('request.auth_error', {
          code: error.code,
          status: error.status,
          reason: error.message,
          ...(error.meta || {}),
          duration_ms: Date.now() - startedAt
        });
        return errorResponse(origin, env, error.status, error.code, error.message, requestId);
      }

      if (error instanceof ValidationError) {
        logger.warn('request.validation_error', {
          status: error.status,
          reason: error.message,
          duration_ms: Date.now() - startedAt
        });
        return errorResponse(origin, env, error.status, 'BAD_REQUEST', error.message, requestId);
      }

      if (error instanceof UpstreamError) {
        logger.error('request.upstream_error', {
          status: error.status,
          reason: error.message,
          duration_ms: Date.now() - startedAt
        });
        return errorResponse(origin, env, error.status, 'UPSTREAM_ERROR', error.message, requestId);
      }

      logger.error('request.internal_error', {
        status: 500,
        duration_ms: Date.now() - startedAt
      });
      return errorResponse(origin, env, 500, 'INTERNAL', 'Internal server error.', requestId);
    }
  }
};
