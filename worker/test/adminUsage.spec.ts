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

interface UsageEventRow {
  event_ts: string;
  request_id: string;
  user_id: string;
  username: string;
  use_case_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const createUsageDbMock = (seed: UsageEventRow[] = []) => {
  const events = [...seed];

  return {
    events,
    async exec() {
      return { success: true };
    },
    prepare(query: string) {
      const normalized = query.toLowerCase();
      let boundValues: unknown[] = [];

      const stmt = {
        bind(...values: unknown[]) {
          boundValues = values;
          return stmt;
        },
        async run() {
          if (normalized.includes('insert into usage_events')) {
            events.push({
              event_ts: String(boundValues[0] || new Date().toISOString()),
              request_id: String(boundValues[1] || ''),
              user_id: String(boundValues[2] || ''),
              username: String(boundValues[3] || ''),
              use_case_id: String(boundValues[4] || ''),
              model: String(boundValues[5] || ''),
              input_tokens: Number(boundValues[6] || 0),
              output_tokens: Number(boundValues[7] || 0)
            });
          }
          return { success: true };
        },
        async first<T = Record<string, unknown>>() {
          const fromTs = String(boundValues[0] || new Date(0).toISOString());
          const fromMs = Date.parse(fromTs);
          const filtered = events.filter((event) => Date.parse(event.event_ts) >= fromMs);
          const users = new Set(filtered.map((event) => event.user_id));

          return {
            requests: filtered.length,
            input_tokens: filtered.reduce((sum, event) => sum + event.input_tokens, 0),
            output_tokens: filtered.reduce((sum, event) => sum + event.output_tokens, 0),
            active_users: users.size
          } as T;
        },
        async all<T = Record<string, unknown>>() {
          if (!normalized.includes('group by user_id')) {
            return { results: [] as T[] };
          }

          const fromTs = String(boundValues[0] || new Date(0).toISOString());
          const fromMs = Date.parse(fromTs);
          const limit = Number(boundValues[1] || 25);
          const filtered = events.filter((event) => Date.parse(event.event_ts) >= fromMs);

          const grouped = new Map<
            string,
            {
              user_id: string;
              username: string;
              requests: number;
              input_tokens: number;
              output_tokens: number;
              last_seen: string;
            }
          >();

          for (const event of filtered) {
            const existing = grouped.get(event.user_id) || {
              user_id: event.user_id,
              username: event.username,
              requests: 0,
              input_tokens: 0,
              output_tokens: 0,
              last_seen: event.event_ts
            };

            existing.requests += 1;
            existing.input_tokens += event.input_tokens;
            existing.output_tokens += event.output_tokens;
            if (Date.parse(event.event_ts) > Date.parse(existing.last_seen)) {
              existing.last_seen = event.event_ts;
            }

            grouped.set(event.user_id, existing);
          }

          const rows = Array.from(grouped.values())
            .sort((a, b) => b.requests - a.requests || Date.parse(b.last_seen) - Date.parse(a.last_seen))
            .slice(0, limit);

          return { results: rows as T[] };
        }
      };

      return stmt;
    }
  };
};

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe('worker admin usage and tracking', () => {
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

  it('returns usage summary for admin users', async () => {
    restoreFetch = await installJwksFetchMock();
    const db = createUsageDbMock([
      {
        event_ts: new Date(Date.now() - 60_000).toISOString(),
        request_id: 'req-1',
        user_id: 'usr_admin',
        username: 'admin_user',
        use_case_id: 'gen',
        model: 'gpt-4o-mini',
        input_tokens: 12,
        output_tokens: 5
      }
    ]);

    const env = buildEnv({
      USAGE_DB: db,
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_admin',
          username: 'admin_user',
          alias: 'admin_alias',
          role: 'admin'
        }
      ])
    });
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/admin/usage?days=7&limit=10', {
      method: 'GET',
      headers: {
        'Cf-Access-Jwt-Assertion': token
      }
    });

    const response = await invokeWorker(request, env);
    const body = await requestJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.totals as Record<string, unknown>).requests).toBe(1);
    expect(Array.isArray(body.users)).toBe(true);
  });

  it('rejects usage summary for non-admin users', async () => {
    restoreFetch = await installJwksFetchMock();
    const env = buildEnv({
      USAGE_DB: createUsageDbMock(),
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_member',
          username: 'member_user',
          alias: 'member_alias',
          role: 'member'
        }
      ])
    });
    const token = await createAccessToken();
    const request = makeRequest('/api/chat/admin/usage', {
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
    expect(error.message).toBe('Admin access required.');
  });

  it('writes usage event on successful /api/chat/respond', async () => {
    restoreFetch = await installJwksAndOpenAIFetchMock();
    const db = createUsageDbMock();
    const env = buildEnv({
      USAGE_DB: db,
      USER_DIRECTORY_JSON: JSON.stringify([
        {
          email: 'allowed@example.com',
          user_id: 'usr_writer',
          username: 'writer_user',
          alias: 'writer_alias',
          role: 'member'
        }
      ])
    });

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
        use_case_id: 'gen',
        messages: [
          {
            role: 'user',
            content: 'track this usage',
            ts: new Date().toISOString()
          }
        ]
      })
    });

    const response = await invokeWorker(request, env);
    expect(response.status).toBe(200);
    expect(db.events.length).toBe(1);
    expect(db.events[0].user_id).toBe('usr_writer');
    expect(db.events[0].username).toBe('writer_user');
    expect(db.events[0].input_tokens).toBe(42);
    expect(db.events[0].output_tokens).toBe(11);
  });
});
