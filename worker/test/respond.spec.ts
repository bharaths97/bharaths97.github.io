import { afterEach, describe, expect, it } from 'vitest';
import { buildEnv, createAccessToken, installJwksFetchMock, invokeWorker, makeRequest, requestJson } from './helpers';

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('worker respond abuse controls', () => {
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
});
