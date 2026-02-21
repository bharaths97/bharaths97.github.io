import type { AccessClaims, AuthContext, Env } from './types';
import { resolveUserIdentity } from './userDirectory';

export class AuthError extends Error {
  status: number;
  code: string;
  meta?: Record<string, unknown>;

  constructor(message: string, status = 401, code = 'UNAUTHORIZED', meta?: Record<string, unknown>) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwksResponse {
  keys: JsonWebKey[];
}

type JwksCacheEntry = {
  keys: JsonWebKey[];
  expiresAtMs: number;
};

const jwksCache = new Map<string, JwksCacheEntry>();

const decodeBase64UrlToBytes = (input: string): Uint8Array => {
  const padding = (4 - (input.length % 4)) % 4;
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const decodeBase64UrlToJson = <T>(input: string): T => {
  const decoded = new TextDecoder().decode(decodeBase64UrlToBytes(input));
  return JSON.parse(decoded) as T;
};

const sanitizeTeamDomain = (teamDomain: string): string => {
  return teamDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
};

const getExpectedIssuer = (env: Env): string => `https://${sanitizeTeamDomain(env.ACCESS_TEAM_DOMAIN)}`;

const fetchJwks = async (env: Env, forceRefresh = false): Promise<JsonWebKey[]> => {
  const now = Date.now();
  const teamDomain = sanitizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const cacheKey = teamDomain.toLowerCase();
  const cached = jwksCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAtMs > now) {
    return cached.keys;
  }

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new AuthError('Unable to fetch Access certificate set.', 503, 'AUTH_CERT_FETCH_FAILED');
  }

  const payload = (await response.json()) as JwksResponse;
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new AuthError('Access certificate set is invalid.', 503, 'AUTH_CERT_INVALID');
  }

  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? Number.parseInt(maxAgeMatch[1], 10) : 300;

  jwksCache.set(cacheKey, {
    keys: payload.keys,
    expiresAtMs: now + Math.max(30, maxAge) * 1000
  });

  return payload.keys;
};

const importVerificationKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
};

const verifyJwtSignature = async (
  token: string,
  header: JwtHeader,
  env: Env
): Promise<void> => {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new AuthError('Malformed access token.', 401, 'UNAUTHORIZED');
  }

  if (header.alg !== 'RS256') {
    throw new AuthError('Unsupported token algorithm.', 401, 'UNAUTHORIZED');
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const data = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signatureBytes = decodeBase64UrlToBytes(signatureSegment);
  const signatureBuffer = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength
  ) as ArrayBuffer;
  let keys = await fetchJwks(env);

  let candidateKeys = header.kid ? keys.filter((key) => (key as { kid?: string }).kid === header.kid) : keys;
  if (header.kid && candidateKeys.length === 0) {
    keys = await fetchJwks(env, true);
    candidateKeys = keys.filter((key) => (key as { kid?: string }).kid === header.kid);
  }

  if (candidateKeys.length === 0) {
    throw new AuthError('No matching verification key found.', 401, 'UNAUTHORIZED');
  }

  for (const jwk of candidateKeys) {
    const key = await importVerificationKey(jwk);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signatureBuffer, data);
    if (verified) {
      return;
    }
  }

  throw new AuthError('Invalid access token signature.', 401, 'UNAUTHORIZED');
};

const parseAllowedEmails = (env: Env): Set<string> => {
  return new Set(
    env.ALLOWED_EMAILS.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
};

const validateClaims = (claims: AccessClaims, env: Env): void => {
  const now = Math.floor(Date.now() / 1000);

  if (!claims.exp || claims.exp <= now) {
    throw new AuthError('Access token is expired.', 401, 'UNAUTHORIZED');
  }

  if (claims.nbf && claims.nbf > now) {
    throw new AuthError('Access token is not valid yet.', 401, 'UNAUTHORIZED');
  }

  const expectedIssuer = getExpectedIssuer(env);
  const normalizedIssuer = claims.iss?.replace(/\/+$/, '');
  if (normalizedIssuer !== expectedIssuer) {
    throw new AuthError('Access token issuer mismatch.', 401, 'UNAUTHORIZED');
  }

  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(env.ACCESS_API_AUD)) {
    throw new AuthError('Access token audience mismatch.', 401, 'UNAUTHORIZED');
  }
};

const getEmailDomain = (email: string): string => email.split('@')[1] || 'unknown';

export const authenticateRequest = async (request: Request, env: Env): Promise<AuthContext> => {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    throw new AuthError('Missing Access assertion.', 401, 'UNAUTHORIZED');
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new AuthError('Malformed access token.', 401, 'UNAUTHORIZED');
  }

  let header: JwtHeader;
  let claims: AccessClaims;
  try {
    header = decodeBase64UrlToJson<JwtHeader>(segments[0]);
    claims = decodeBase64UrlToJson<AccessClaims>(segments[1]);
  } catch {
    throw new AuthError('Malformed access token payload.', 401, 'UNAUTHORIZED');
  }

  await verifyJwtSignature(token, header, env);
  validateClaims(claims, env);

  const email = claims.email?.trim().toLowerCase();
  if (!email) {
    throw new AuthError('Email claim missing in Access token.', 403, 'FORBIDDEN', {
      subject_prefix: claims.sub?.slice(0, 8) || 'unknown'
    });
  }

  const allowedEmails = parseAllowedEmails(env);
  if (!allowedEmails.has(email)) {
    throw new AuthError('User is not allowed for this API.', 403, 'FORBIDDEN', {
      attempted_email: email,
      attempted_email_domain: getEmailDomain(email),
      subject_prefix: claims.sub?.slice(0, 8) || 'unknown'
    });
  }

  let identity: Awaited<ReturnType<typeof resolveUserIdentity>>;
  try {
    identity = await resolveUserIdentity(email, claims, env);
  } catch {
    throw new AuthError('User identity mapping is not configured for this account.', 403, 'FORBIDDEN', {
      attempted_email: email,
      attempted_email_domain: getEmailDomain(email),
      subject_prefix: claims.sub?.slice(0, 8) || 'unknown'
    });
  }

  return {
    claims,
    email,
    identity
  };
};

const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const deriveSessionId = async (auth: AuthContext, env: Env): Promise<string> => {
  const audience = Array.isArray(auth.claims.aud) ? auth.claims.aud[0] || '' : auth.claims.aud || '';
  const nonce = auth.claims.identity_nonce || '';
  const material = `${auth.claims.sub}|${nonce}|${audience}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material));
  return encodeBase64Url(new Uint8Array(signature));
};
