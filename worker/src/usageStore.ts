import type { ChatAdminUsageResponse, ChatMemoryMode, Env } from './types';

interface UsageEventInsert {
  requestId: string;
  userId: string;
  username: string;
  useCaseId: string;
  memoryMode: ChatMemoryMode;
  model: string;
  inputTokens: number;
  outputTokens: number;
  eventTs: string;
}

interface TotalsRow {
  requests?: number | string | null;
  input_tokens?: number | string | null;
  output_tokens?: number | string | null;
  active_users?: number | string | null;
}

interface UserRow {
  user_id?: string | null;
  username?: string | null;
  requests?: number | string | null;
  input_tokens?: number | string | null;
  output_tokens?: number | string | null;
  classic_requests?: number | string | null;
  classic_input_tokens?: number | string | null;
  classic_output_tokens?: number | string | null;
  tiered_requests?: number | string | null;
  tiered_input_tokens?: number | string | null;
  tiered_output_tokens?: number | string | null;
  last_seen?: string | null;
}

interface ModeTotalsRow {
  memory_mode?: string | null;
  requests?: number | string | null;
  input_tokens?: number | string | null;
  output_tokens?: number | string | null;
}

let schemaReadyPromise: Promise<void> | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_ts TEXT NOT NULL,
    request_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    use_case_id TEXT NOT NULL,
    memory_mode TEXT NOT NULL DEFAULT 'classic',
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events(event_ts)',
  'CREATE INDEX IF NOT EXISTS idx_usage_events_user_ts ON usage_events(user_id, event_ts)'
];

const normalizeInt = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }

  return 0;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeMemoryMode = (value: unknown): ChatMemoryMode => {
  return value === 'tiered' ? 'tiered' : 'classic';
};

const toIsoOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
};

const assertUsageDb = (env: Env): NonNullable<Env['USAGE_DB']> => {
  if (!env.USAGE_DB) {
    throw new Error('USAGE_DB binding is not configured.');
  }
  return env.USAGE_DB;
};

const hasUsageColumn = async (db: NonNullable<Env['USAGE_DB']>, columnName: string): Promise<boolean> => {
  const rows = (await db.prepare('PRAGMA table_info(usage_events)').all<{ name?: string }>()).results || [];
  return rows.some((row) => row.name === columnName);
};

const ensureSchema = async (env: Env): Promise<void> => {
  const db = assertUsageDb(env);

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
      }

      if (!(await hasUsageColumn(db, 'memory_mode'))) {
        await db.prepare(`ALTER TABLE usage_events ADD COLUMN memory_mode TEXT NOT NULL DEFAULT 'classic'`).run();
      }

      await db.prepare('CREATE INDEX IF NOT EXISTS idx_usage_events_mode_ts ON usage_events(memory_mode, event_ts)').run();
    })();
  }

  await schemaReadyPromise;
};

export const hasUsageDb = (env: Env): boolean => Boolean(env.USAGE_DB);

export const recordUsageEvent = async (env: Env, entry: UsageEventInsert): Promise<void> => {
  const db = assertUsageDb(env);
  await ensureSchema(env);

  await db
    .prepare(
      `INSERT INTO usage_events (
        event_ts, request_id, user_id, username, use_case_id, memory_mode, model, input_tokens, output_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.eventTs,
      entry.requestId,
      entry.userId,
      entry.username,
      entry.useCaseId,
      entry.memoryMode,
      entry.model,
      normalizeInt(entry.inputTokens),
      normalizeInt(entry.outputTokens)
    )
    .run();
};

export const getUsageSummary = async (
  env: Env,
  options: {
    windowDays: number;
    maxUsers: number;
  }
): Promise<ChatAdminUsageResponse> => {
  const db = assertUsageDb(env);
  await ensureSchema(env);

  const windowDays = clamp(options.windowDays, 1, 365);
  const maxUsers = clamp(options.maxUsers, 1, 100);
  const fromTs = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const totalsRow =
    (await db
      .prepare(
        `SELECT
          COUNT(*) AS requests,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COUNT(DISTINCT user_id) AS active_users
        FROM usage_events
        WHERE event_ts >= ?`
      )
      .bind(fromTs)
      .first<TotalsRow>()) || {};

  const modeRows =
    (
      await db
        .prepare(
          `SELECT
            memory_mode,
            COUNT(*) AS requests,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens
          FROM usage_events
          WHERE event_ts >= ?
          GROUP BY memory_mode`
        )
        .bind(fromTs)
        .all<ModeTotalsRow>()
    ).results || [];

  const totalsByMode: ChatAdminUsageResponse['totals_by_mode'] = {
    classic: {
      requests: 0,
      input_tokens: 0,
      output_tokens: 0
    },
    tiered: {
      requests: 0,
      input_tokens: 0,
      output_tokens: 0
    }
  };

  for (const row of modeRows) {
    const mode = normalizeMemoryMode(row.memory_mode);
    totalsByMode[mode] = {
      requests: normalizeInt(row.requests),
      input_tokens: normalizeInt(row.input_tokens),
      output_tokens: normalizeInt(row.output_tokens)
    };
  }

  const usersRows =
    (
      await db
        .prepare(
          `SELECT
            user_id,
            username,
            COUNT(*) AS requests,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(CASE WHEN memory_mode = 'classic' THEN 1 ELSE 0 END), 0) AS classic_requests,
            COALESCE(SUM(CASE WHEN memory_mode = 'classic' THEN input_tokens ELSE 0 END), 0) AS classic_input_tokens,
            COALESCE(SUM(CASE WHEN memory_mode = 'classic' THEN output_tokens ELSE 0 END), 0) AS classic_output_tokens,
            COALESCE(SUM(CASE WHEN memory_mode = 'tiered' THEN 1 ELSE 0 END), 0) AS tiered_requests,
            COALESCE(SUM(CASE WHEN memory_mode = 'tiered' THEN input_tokens ELSE 0 END), 0) AS tiered_input_tokens,
            COALESCE(SUM(CASE WHEN memory_mode = 'tiered' THEN output_tokens ELSE 0 END), 0) AS tiered_output_tokens,
            MAX(event_ts) AS last_seen
          FROM usage_events
          WHERE event_ts >= ?
          GROUP BY user_id, username
          ORDER BY requests DESC, last_seen DESC
          LIMIT ?`
        )
        .bind(fromTs, maxUsers)
        .all<UserRow>()
    ).results || [];

  return {
    ok: true,
    window_days: windowDays,
    generated_at: new Date().toISOString(),
    totals: {
      requests: normalizeInt(totalsRow.requests),
      input_tokens: normalizeInt(totalsRow.input_tokens),
      output_tokens: normalizeInt(totalsRow.output_tokens),
      active_users: normalizeInt(totalsRow.active_users)
    },
    totals_by_mode: totalsByMode,
    users: usersRows.map((row) => ({
      user_id: row.user_id || 'unknown_user',
      username: row.username || 'unknown_user',
      requests: normalizeInt(row.requests),
      input_tokens: normalizeInt(row.input_tokens),
      output_tokens: normalizeInt(row.output_tokens),
      mode_breakdown: {
        classic: {
          requests: normalizeInt(row.classic_requests),
          input_tokens: normalizeInt(row.classic_input_tokens),
          output_tokens: normalizeInt(row.classic_output_tokens)
        },
        tiered: {
          requests: normalizeInt(row.tiered_requests),
          input_tokens: normalizeInt(row.tiered_input_tokens),
          output_tokens: normalizeInt(row.tiered_output_tokens)
        }
      },
      last_seen: toIsoOrNull(row.last_seen)
    }))
  };
};
