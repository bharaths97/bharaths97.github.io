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
  memory_mode: 'classic' | 'tiered';
  model: string;
  input_tokens: number;
  output_tokens: number;
}

const createUsageDbMock = (seed: UsageEventRow[] = []) => {
  const events = [...seed];
  let hasMemoryModeColumn = true;

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
              memory_mode: boundValues[5] === 'tiered' ? 'tiered' : 'classic',
              model: String(boundValues[6] || ''),
              input_tokens: Number(boundValues[7] || 0),
              output_tokens: Number(boundValues[8] || 0)
            });
          }
          if (normalized.includes('alter table usage_events add column memory_mode')) {
            hasMemoryModeColumn = true;
            for (const event of events) {
              if (!event.memory_mode) {
                event.memory_mode = 'classic';
              }
            }
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
          if (normalized.includes('pragma table_info(usage_events)')) {
            const results = [
              { name: 'id' },
              { name: 'event_ts' },
              { name: 'request_id' },
              { name: 'user_id' },
              { name: 'username' },
              { name: 'use_case_id' },
              ...(hasMemoryModeColumn ? [{ name: 'memory_mode' }] : []),
              { name: 'model' },
              { name: 'input_tokens' },
              { name: 'output_tokens' }
            ];
            return { results: results as T[] };
          }

          if (normalized.includes('group by memory_mode')) {
            const fromTs = String(boundValues[0] || new Date(0).toISOString());
            const fromMs = Date.parse(fromTs);
            const filtered = events.filter((event) => Date.parse(event.event_ts) >= fromMs);
            const modeRows: Array<{
              memory_mode: 'classic' | 'tiered';
              requests: number;
              input_tokens: number;
              output_tokens: number;
            }> = [
              { memory_mode: 'classic', requests: 0, input_tokens: 0, output_tokens: 0 },
              { memory_mode: 'tiered', requests: 0, input_tokens: 0, output_tokens: 0 }
            ];

            for (const event of filtered) {
              const bucket = modeRows.find((row) => row.memory_mode === event.memory_mode);
              if (!bucket) continue;
              bucket.requests += 1;
              bucket.input_tokens += event.input_tokens;
              bucket.output_tokens += event.output_tokens;
            }

            return { results: modeRows.filter((row) => row.requests > 0) as T[] };
          }

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
                classic_requests: number;
                classic_input_tokens: number;
                classic_output_tokens: number;
                tiered_requests: number;
                tiered_input_tokens: number;
                tiered_output_tokens: number;
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
              classic_requests: 0,
              classic_input_tokens: 0,
              classic_output_tokens: 0,
              tiered_requests: 0,
              tiered_input_tokens: 0,
              tiered_output_tokens: 0,
              last_seen: event.event_ts
            };

            existing.requests += 1;
            existing.input_tokens += event.input_tokens;
            existing.output_tokens += event.output_tokens;
            if (event.memory_mode === 'tiered') {
              existing.tiered_requests += 1;
              existing.tiered_input_tokens += event.input_tokens;
              existing.tiered_output_tokens += event.output_tokens;
            } else {
              existing.classic_requests += 1;
              existing.classic_input_tokens += event.input_tokens;
              existing.classic_output_tokens += event.output_tokens;
            }
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
        memory_mode: 'classic',
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
    expect((body.totals_by_mode as Record<string, unknown>).classic).toBeTruthy();
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
    expect(db.events[0].memory_mode).toBe('classic');
    expect(db.events[0].input_tokens).toBe(42);
    expect(db.events[0].output_tokens).toBe(11);
  });
});
