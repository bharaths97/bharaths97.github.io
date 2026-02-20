import worker from '../src/index';
import type { AccessClaims, Env } from '../src/types';

const TEST_TEAM_DOMAIN = 'test-team.cloudflareaccess.com';
const TEST_AUD = 'test-access-aud';
const TEST_ORIGIN = 'http://localhost:5173';
const TEST_EMAIL = 'allowed@example.com';

let keyPairPromise: Promise<CryptoKeyPair> | null = null;

const base64UrlJson = (value: unknown): string => {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
};

const base64UrlBytes = (value: ArrayBuffer): string => {
  return Buffer.from(value).toString('base64url');
};

const getKeyPair = async (): Promise<CryptoKeyPair> => {
  if (keyPairPromise) return keyPairPromise;

  keyPairPromise = crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  return keyPairPromise;
};

export const buildEnv = (overrides: Partial<Env> = {}): Env => ({
  OPENAI_API_KEY: 'test-openai-key',
  SESSION_HMAC_SECRET: 'test-session-hmac-secret',
  ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN,
  ACCESS_API_AUD: TEST_AUD,
  ALLOWED_ORIGINS: TEST_ORIGIN,
  ALLOWED_EMAILS: TEST_EMAIL,
  OPENAI_MODEL: 'gpt-4o-mini',
  MAX_USER_CHARS: '2000',
  MAX_CONTEXT_MESSAGES: '12',
  MAX_CONTEXT_CHARS: '12000',
  MAX_TURNS: '30',
  MAX_OUTPUT_TOKENS: '400',
  OPENAI_TIMEOUT_MS: '15000',
  LOG_LEVEL: 'error',
  ...overrides
});

export const createAccessToken = async (overrides: Partial<AccessClaims> = {}): Promise<string> => {
  const keyPair = await getKeyPair();
  const header = {
    alg: 'RS256',
    kid: 'test-kid'
  };

  const now = Math.floor(Date.now() / 1000);
  const claims: AccessClaims = {
    iss: `https://${TEST_TEAM_DOMAIN}`,
    aud: TEST_AUD,
    exp: now + 60 * 10,
    iat: now,
    nbf: now - 10,
    sub: 'user-subject-123',
    email: TEST_EMAIL,
    name: 'allowed_user',
    identity_nonce: 'test-nonce',
    ...overrides
  };

  const encodedHeader = base64UrlJson(header);
  const encodedClaims = base64UrlJson(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signingInput));
  const encodedSignature = base64UrlBytes(signature);

  return `${signingInput}.${encodedSignature}`;
};

export const installJwksFetchMock = async (): Promise<() => void> => {
  const keyPair = await getKeyPair();
  const exportedPublicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  const publicJwk: JsonWebKey = {
    ...exportedPublicJwk,
    kid: 'test-kid'
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url === `https://${TEST_TEAM_DOMAIN}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300'
        }
      });
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
};

export const requestJson = async (response: Response): Promise<Record<string, unknown>> => {
  return (await response.json()) as Record<string, unknown>;
};

export const makeRequest = (path: string, init: RequestInit = {}): Request => {
  const headers = new Headers(init.headers);
  if (!headers.has('Origin')) {
    headers.set('Origin', TEST_ORIGIN);
  }

  return new Request(`https://example.com${path}`, {
    ...init,
    headers
  });
};

export const invokeWorker = async (request: Request, env: Env): Promise<Response> => {
  return worker.fetch(request, env);
};
