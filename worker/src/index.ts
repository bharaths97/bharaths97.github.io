import { authenticateRequest, AuthError, deriveSessionId } from './access';
import { createRequestLogger } from './logger';
import { generateAssistantReply, UpstreamError } from './openai';
import { enforceRespondRateLimit } from './rateLimit';
import { errorResponse, getLimits, handleOptions, isOriginAllowed, jsonResponse, noContentResponse } from './security';
import type { ChatRespondResponse, ChatSessionResponse, Env } from './types';
import { validateResetPayload, validateRespondPayload, ValidationError } from './validation';

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
  email: string,
  displayName: string,
  exp: number,
  limits: ReturnType<typeof getLimits>
): ChatSessionResponse => ({
  ok: true,
  session_id: sessionId,
  user: {
    email,
    display_name: displayName
  },
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

      if (url.pathname === '/api/chat/session' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        const sessionId = await deriveSessionId(auth, env);
        const limits = getLimits(env);

        logger.info('chat.session.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          email_domain: emailDomain(auth.email),
          duration_ms: Date.now() - startedAt
        });

        return jsonResponse(
          origin,
          env,
          toSessionResponse(sessionId, auth.email, auth.displayName, auth.claims.exp, limits),
          200
        );
      }

      if (url.pathname === '/api/chat/respond' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        await enforceRespondRateLimit(auth, env);
        const expectedSessionId = await deriveSessionId(auth, env);
        const limits = getLimits(env);

        let requestBody: unknown;
        try {
          requestBody = await request.json();
        } catch {
          throw new ValidationError('Malformed JSON body.');
        }

        const payload = validateRespondPayload(requestBody, {
          maxUserChars: limits.maxUserChars,
          maxContextMessages: limits.maxContextMessages,
          maxContextChars: limits.maxContextChars,
          maxTurns: limits.maxTurns
        });

        if (payload.session_id !== expectedSessionId) {
          throw new AuthError('Session mismatch.', 403, 'FORBIDDEN');
        }

        const assistant = await generateAssistantReply(env, payload.messages, {
          maxContextMessages: limits.maxContextMessages,
          maxOutputTokens: limits.maxOutputTokens,
          timeoutMs: limits.openAiTimeoutMs
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
            expires_at: new Date(auth.claims.exp * 1000).toISOString()
          }
        };

        logger.info('chat.respond.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          email_domain: emailDomain(auth.email),
          model: response.usage?.model,
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
          duration_ms: Date.now() - startedAt
        });

        return jsonResponse(origin, env, response, 200);
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

        logger.info('chat.reset.success', {
          subject_prefix: subjectPrefix(auth.claims.sub),
          duration_ms: Date.now() - startedAt
        });

        return noContentResponse(origin, env);
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
