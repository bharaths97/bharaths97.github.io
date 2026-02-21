import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildEnv,
  createAccessToken,
  installJwksAndOpenAIFetchMock,
  invokeWorker,
  makeRequest,
  requestJson
} from '../helpers';
import { getSessionMemory, resetSessionStoreForTests } from '../../src/memory/store';

let restoreFetch: (() => void) | null = null;

beforeEach(() => {
  resetSessionStoreForTests();
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('tiered memory respond integration', () => {
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

  it('updates in-memory structures after successful respond when enabled', async () => {
    restoreFetch = await installJwksAndOpenAIFetchMock('assistant output');
    const env = buildEnv({
      ENABLE_TIERED_MEMORY: 'true',
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_mem_1',
          username: 'mem_user',
          alias: 'mem_alias',
          role: 'member'
        }
      ])
    });
    const token = await createAccessToken();
    const sessionId = await getSessionId(env, token);

    const respondRequest = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: sessionId,
        use_case_id: 'gen',
        memory_mode: 'tiered',
        messages: [
          {
            role: 'user',
            content: 'track this turn in memory',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const respondResponse = await invokeWorker(respondRequest, env);
    expect(respondResponse.status).toBe(200);

    const memory = getSessionMemory(sessionId, 'usr_mem_1');
    expect(memory).not.toBeNull();
    expect(memory?.turnLog.length).toBe(1);
    expect(memory?.rawWindow.length).toBe(2);
    expect(memory?.rawWindow[0].role).toBe('user');
    expect(memory?.rawWindow[1].role).toBe('assistant');
  });

  it('clears in-memory session on reset', async () => {
    restoreFetch = await installJwksAndOpenAIFetchMock('assistant output');
    const env = buildEnv({
      ENABLE_TIERED_MEMORY: 'true',
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_mem_2',
          username: 'mem_user_2',
          alias: 'mem_alias_2',
          role: 'member'
        }
      ])
    });
    const token = await createAccessToken();
    const sessionId = await getSessionId(env, token);

    const respondRequest = makeRequest('/api/chat/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({
        session_id: sessionId,
        memory_mode: 'tiered',
        messages: [
          {
            role: 'user',
            content: 'first turn',
            ts: new Date().toISOString()
          }
        ]
      })
    });
    const respondResponse = await invokeWorker(respondRequest, env);
    expect(respondResponse.status).toBe(200);
    expect(getSessionMemory(sessionId, 'usr_mem_2')).not.toBeNull();

    const resetRequest = makeRequest('/api/chat/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': token
      },
      body: JSON.stringify({ session_id: sessionId })
    });
    const resetResponse = await invokeWorker(resetRequest, env);
    expect(resetResponse.status).toBe(204);
    expect(getSessionMemory(sessionId, 'usr_mem_2')).toBeNull();
  });
});
