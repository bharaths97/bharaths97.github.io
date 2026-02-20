import { afterEach, describe, expect, it } from 'vitest';
import { buildEnv, createAccessToken, installJwksFetchMock, invokeWorker, makeRequest, requestJson } from './helpers';

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('worker auth controls', () => {
  it('rejects /api/chat/session when Access assertion is missing', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const request = makeRequest('/api/chat/session', { method: 'GET' });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('rejects token with incorrect audience', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const token = await createAccessToken({ aud: 'wrong-aud' });
    const request = makeRequest('/api/chat/session', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('rejects user outside allowlist', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const token = await createAccessToken({ email: 'blocked@example.com' });
    const request = makeRequest('/api/chat/session', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });
});
