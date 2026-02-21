import { afterEach, describe, expect, it } from 'vitest';
import {
  buildEnv,
  createAccessToken,
  installJwksAndOpenAIFetchMock,
  installJwksFetchMock,
  invokeWorker,
  makeRequest,
  requestJson
} from './helpers';

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('worker respond abuse controls', () => {
  const getSessionId = async (env: ReturnType<typeof buildEnv>, token: string): Promise<string> => {
    const sessionRequest = makeRequest('/api/chat/session', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });
    const sessionResponse = await invokeWorker(sessionRequest, env);
    const sessionBody = await requestJson(sessionResponse);
    return String(sessionBody.session_id);
  };

  it('rejects oversized user message payload with BAD_REQUEST', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv({ MAX_USER_CHARS: '5' });
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: 'placeholder',
        messages: [
          {
            role: 'user',
            content: 'too-long',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('returns 429 when burst limiter is exceeded', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv({
      RESPOND_BURST_LIMITER: {
        limit: async () => ({ success: false })
      }
    });
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({})
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED_BURST');
  });

  it('rejects unknown use_case_id on first turn', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const token = await createAccessToken();
    const sessionId = await getSessionId(env, token);
    const request = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: sessionId,
        use_case_id: 'does_not_exist',
        messages: [
          {
            role: 'user',
            content: 'test',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Unknown use_case_id.');
  });

  it('rejects attempts to change use_case_id after lock token is issued', async () => {
    restoreFetch = await installJwksAndOpenAIFetchMock();
    const env = buildEnv();
    const token = await createAccessToken();
    const sessionId = await getSessionId(env, token);

    const firstRespondRequest = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: sessionId,
        use_case_id: 'gen',
        messages: [
          {
            role: 'user',
            content: 'first turn',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const firstRespondResponse = await invokeWorker(firstRespondRequest, env);
    const firstRespondBody = await requestJson(firstRespondResponse);
    const lockToken = String((firstRespondBody.session as Record<string, unknown>).use_case_lock_token || '');

    expect(firstRespondResponse.status).toBe(200);
    expect(lockToken.length).toBeGreaterThan(10);

    const secondRespondRequest = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: sessionId,
        use_case_id: 'cat',
        use_case_lock_token: lockToken,
        messages: [
          {
            role: 'user',
            content: 'first turn',
            ts: new Date(Date.now() - 1000).toISOString()
          },
          {
            role: 'assistant',
            content: 'assistant reply',
            ts: new Date(Date.now() - 900).toISOString()
          },
          {
            role: 'user',
            content: 'second turn',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const secondRespondResponse = await invokeWorker(secondRespondRequest, env);
    const secondRespondBody = await requestJson(secondRespondResponse);
    const error = secondRespondBody.error as Record<string, unknown>;

    expect(secondRespondResponse.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('use_case_id is locked for this session.');
  });
});
