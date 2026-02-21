import type { Env } from './types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const SENSITIVE_KEY_PATTERN = /(prompt|content|messages|authorization|token|secret|api[_-]?key|cf-access-jwt-assertion)/i;
const TOKEN_COUNT_KEYS = new Set([
  'prompt_tokens',
  'completion_tokens',
  'input_tokens',
  'output_tokens',
  'total_tokens'
]);

const MAX_STRING_LENGTH = 300;
const MAX_DEPTH = 4;

const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return '[truncated-depth]';

  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.trim().toLowerCase();
      const isTokenCount = TOKEN_COUNT_KEYS.has(normalizedKey) && typeof raw === 'number';

      if (!isTokenCount && SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[redacted]';
      } else {
        result[key] = sanitize(raw, depth + 1);
      }
    }

    return result;
  }

  return '[unsupported-type]';
};

const parseLogLevel = (raw: string | undefined): LogLevel => {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }

  return 'info';
};

const shouldLog = (configuredLevel: LogLevel, eventLevel: LogLevel): boolean => {
  return LOG_LEVEL_ORDER[eventLevel] >= LOG_LEVEL_ORDER[configuredLevel];
};

interface RequestLogger {
  debug: (event: string, meta?: Record<string, unknown>) => void;
  info: (event: string, meta?: Record<string, unknown>) => void;
  warn: (event: string, meta?: Record<string, unknown>) => void;
  error: (event: string, meta?: Record<string, unknown>) => void;
}

export const createRequestLogger = (
  env: Env,
  context: {
    requestId: string;
    method: string;
    path: string;
  }
): RequestLogger => {
  const configuredLevel = parseLogLevel(env.LOG_LEVEL);

  const emit = (level: LogLevel, event: string, meta: Record<string, unknown> = {}): void => {
    if (!shouldLog(configuredLevel, level)) return;

    const sanitizedMeta = sanitize(meta);
    const safeMeta =
      typeof sanitizedMeta === 'object' && sanitizedMeta !== null && !Array.isArray(sanitizedMeta)
        ? (sanitizedMeta as Record<string, unknown>)
        : {};

    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      request_id: context.requestId,
      method: context.method,
      path: context.path,
      ...safeMeta
    };

    console.log(JSON.stringify(entry));
  };

  return {
    debug: (event, meta) => emit('debug', event, meta),
    info: (event, meta) => emit('info', event, meta),
    warn: (event, meta) => emit('warn', event, meta),
    error: (event, meta) => emit('error', event, meta)
  };
};
