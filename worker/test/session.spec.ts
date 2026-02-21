import { afterEach, describe, expect, it } from 'vitest';
import { buildEnv, createAccessToken, installJwksFetchMock, invokeWorker, makeRequest, requestJson } from './helpers';

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('worker session behavior', () => {
  it('returns session payload for valid authenticated request', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/session', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.session_id).toBe('string');
    expect(body.capabilities).toEqual({
      control_center: false
    });
    expect(body.user).toEqual({
      username: 'allowed_user'
    });
    expect((body.user as Record<string, unknown>).email).toBeUndefined();
    expect(body.selected_memory_mode).toBeNull();
    expect(Array.isArray(body.memory_modes)).toBe(true);
    expect((body.memory_modes as Array<{ id: string }>)[0]?.id).toBe('classic');
  });

  it('returns mapped username when USER_DIRECTORY_JSON is configured', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv({
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_allowed_001',
          username: 'bharath',
          alias: 'mirrorball',
          role: 'admin'
        }
      ])
    });
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/session', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);

    expect(response.status).toBe(200);
    expect(body.capabilities).toEqual({
      control_center: true
    });
    expect(body.user).toEqual({
      username: 'bharath'
    });
    expect((body.user as Record<string, unknown>).email).toBeUndefined();
  });

  it('rejects allowlisted email when USER_DIRECTORY_JSON omits mapping', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv({
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'someone-else@example.com',
          user_id: 'usr_someone_else',
          username: 'someone_else',
          alias: 'someone_else',
          role: 'member'
        }
      ])
    });
    const token = await createAccessToken();
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
    expect(error.message).toBe('User identity mapping is not configured for this account.');
  });

  it('rejects /api/chat/respond when request session_id mismatches authenticated session', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv();
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: 'wrong-session-id',
        messages: [
          {
            role: 'user',
            content: 'session mismatch test',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);
    const error = body.error as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Session mismatch.');
  });
});
