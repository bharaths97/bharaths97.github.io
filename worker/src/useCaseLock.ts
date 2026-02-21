import type { ChatMemoryMode, Env } from './types';

export const USE_CASE_LOCK_COOKIE = 'chat_use_case_lock';

interface UseCaseLockPayload {
  sid: string;
  uc: string;
  mm: ChatMemoryMode;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toBase64Url = (value: string): string => {
  const base64 = toBase64(encoder.encode(value));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return decoder.decode(fromBase64(padded));
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
};

const importHmacKey = async (env: Env): Promise<CryptoKey> => {
  const secret = `${env.SESSION_HMAC_SECRET}:use-case-lock`;
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
};

const sign = async (env: Env, value: string): Promise<string> => {
  const key = await importHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const base64 = toBase64(new Uint8Array(signature));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const parsePayload = (value: string): UseCaseLockPayload | null => {
  try {
    const parsed = JSON.parse(value) as Partial<UseCaseLockPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.sid !== 'string') return null;
    if (typeof parsed.uc !== 'string') return null;
    const memoryMode: ChatMemoryMode =
      parsed.mm === 'tiered' || parsed.mm === 'classic' ? parsed.mm : 'classic';
    if (typeof parsed.exp !== 'number') return null;
    return {
      sid: parsed.sid,
      uc: parsed.uc,
      mm: memoryMode,
      exp: parsed.exp
    };
  } catch {
    return null;
  }
};

export const createUseCaseLockToken = async (
  env: Env,
  sessionId: string,
  useCaseId: string,
  memoryMode: ChatMemoryMode,
  expiresAtEpochSeconds: number
): Promise<string> => {
  const payload: UseCaseLockPayload = {
    sid: sessionId,
    uc: useCaseId,
    mm: memoryMode,
    exp: expiresAtEpochSeconds
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await sign(env, encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyUseCaseLockToken = async (
  env: Env,
  token: string,
  expectedSessionId: string,
  nowEpochSeconds: number
): Promise<{ useCaseId: string; memoryMode: ChatMemoryMode; expiresAt: number } | null> => {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await sign(env, encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(fromBase64Url(encodedPayload));
  if (!payload) return null;
  if (payload.sid !== expectedSessionId) return null;
  if (payload.exp <= nowEpochSeconds) return null;

  return {
    useCaseId: payload.uc,
    memoryMode: payload.mm,
    expiresAt: payload.exp
  };
};

export const parseCookie = (request: Request, cookieName: string): string | null => {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookiePart of cookies) {
    const [name, ...rest] = cookiePart.trim().split('=');
    if (name !== cookieName) continue;
    return rest.join('=') || null;
  }

  return null;
};

export const buildUseCaseLockSetCookie = (token: string, maxAgeSeconds: number): string => {
  return `${USE_CASE_LOCK_COOKIE}=${token}; Max-Age=${maxAgeSeconds}; Path=/api/chat; HttpOnly; Secure; SameSite=None`;
};

export const buildUseCaseLockClearCookie = (): string => {
  return `${USE_CASE_LOCK_COOKIE}=; Max-Age=0; Path=/api/chat; HttpOnly; Secure; SameSite=None`;
};
