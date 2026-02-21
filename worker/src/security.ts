import type { Env } from './types';

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer'
};

const parseList = (raw: string): string[] =>
  raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

export const parseNumeric = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const getLimits = (env: Env) => ({
  maxUserChars: parseNumeric(env.MAX_USER_CHARS, 2000, 1, 8000),
  maxContextMessages: parseNumeric(env.MAX_CONTEXT_MESSAGES, 12, 1, 40),
  maxContextChars: parseNumeric(env.MAX_CONTEXT_CHARS, 12000, 100, 60000),
  maxTurns: parseNumeric(env.MAX_TURNS, 30, 1, 200)
});

export const isOriginAllowed = (origin: string | null, env: Env): boolean => {
  // Allow missing Origin for same-origin/non-browser callers.
  if (!origin) return true;

  const allowedOrigins = parseList(env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) return false;

  return allowedOrigins.includes(origin.toLowerCase());
};

export const getCorsHeaders = (origin: string | null, env: Env): Record<string, string> => {
  if (!origin || !isOriginAllowed(origin, env)) {
    return {
      'Vary': 'Origin'
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin'
  };
};

const mergeHeaders = (origin: string | null, env: Env, extra?: HeadersInit): Headers => {
  const headers = new Headers({
    ...SECURITY_HEADERS,
    ...getCorsHeaders(origin, env)
  });

  if (extra) {
    new Headers(extra).forEach((value, key) => headers.set(key, value));
  }

  return headers;
};

export const jsonResponse = (
  origin: string | null,
  env: Env,
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit
): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: mergeHeaders(origin, env, {
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {})
    })
  });
};

export const noContentResponse = (origin: string | null, env: Env, extraHeaders?: HeadersInit): Response => {
  return new Response(null, {
    status: 204,
    headers: mergeHeaders(origin, env, extraHeaders)
  });
};

export const redirectResponse = (
  origin: string | null,
  env: Env,
  location: string,
  status = 302
): Response => {
  return new Response(null, {
    status,
    headers: mergeHeaders(origin, env, {
      Location: location
    })
  });
};

export const errorResponse = (
  origin: string | null,
  env: Env,
  status: number,
  code: string,
  message: string,
  requestId: string
): Response => {
  return jsonResponse(
    origin,
    env,
    {
      ok: false,
      error: {
        code,
        message,
        request_id: requestId
      }
    },
    status
  );
};

export const handleOptions = (request: Request, env: Env): Response => {
  const origin = request.headers.get('Origin');

  if (!isOriginAllowed(origin, env)) {
    return errorResponse(origin, env, 403, 'FORBIDDEN', 'Origin not allowed.', crypto.randomUUID());
  }

  return new Response(null, {
    status: 204,
    headers: mergeHeaders(origin, env)
  });
};
