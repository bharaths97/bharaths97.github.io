import { authenticateRequest, AuthError, deriveSessionId } from './access';
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

const logUsage = (
  requestId: string,
  auth: Awaited<ReturnType<typeof authenticateRequest>>,
  usage: ChatRespondResponse['usage']
): void => {
  console.log(
    JSON.stringify({
      event: 'chat.respond.success',
      request_id: requestId,
      subject_prefix: auth.claims.sub.slice(0, 8),
      model: usage?.model,
      input_tokens: usage?.input_tokens,
      output_tokens: usage?.output_tokens
    })
  );
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const requestId = crypto.randomUUID();

    try {
      if (request.method === 'OPTIONS') {
        return handleOptions(request, env);
      }

      ensureAllowedOrigin(origin, env);

      if (url.pathname === '/api/chat/session' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        const sessionId = await deriveSessionId(auth, env);
        const limits = getLimits(env);

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

        logUsage(requestId, auth, response.usage);
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

        return noContentResponse(origin, env);
      }

      return badRoute(origin, env, requestId);
    } catch (error) {
      if (error instanceof AuthError) {
        return errorResponse(origin, env, error.status, error.code, error.message, requestId);
      }

      if (error instanceof ValidationError) {
        return errorResponse(origin, env, error.status, 'BAD_REQUEST', error.message, requestId);
      }

      if (error instanceof UpstreamError) {
        return errorResponse(origin, env, error.status, 'UPSTREAM_ERROR', error.message, requestId);
      }

      return errorResponse(origin, env, 500, 'INTERNAL', 'Internal server error.', requestId);
    }
  }
};
