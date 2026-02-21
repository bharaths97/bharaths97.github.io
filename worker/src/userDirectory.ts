import type { AccessClaims, Env } from './types';

export interface UserIdentity {
  user_id: string;
  username: string;
  alias: string;
  role: 'admin' | 'member';
}

interface UserDirectoryEntry {
  email: string;
  user_id: string;
  username: string;
  alias?: string;
  role?: string;
}

const USER_ID_PATTERN = /^[A-Za-z0-9._:-]{3,64}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{2,64}$/;
const ALIAS_PATTERN = /^[A-Za-z0-9._ -]{1,64}$/;
const ROLE_VALUES = new Set(['admin', 'member']);

let cachedRaw = '';
let cachedDirectory: Map<string, UserIdentity> | null = null;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeAlias = (value: string): string => value.trim().replace(/\s+/g, ' ');

const getFallbackUsername = (claims: AccessClaims, email: string): string => {
  const fromName = claims.name?.trim();
  if (fromName && USERNAME_PATTERN.test(fromName.replace(/\s+/g, '_'))) {
    return fromName.replace(/\s+/g, '_');
  }

  const local = email.split('@')[0]?.trim() || 'authorized_user';
  const cleaned = local.replace(/[^A-Za-z0-9._-]/g, '_');
  return cleaned.slice(0, 64) || 'authorized_user';
};

const deriveUserId = async (email: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const bytes = Array.from(new Uint8Array(digest).slice(0, 12));
  return `user_${bytes.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

const parseDirectory = (raw: string): Map<string, UserIdentity> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('USER_DIRECTORY_JSON is not valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('USER_DIRECTORY_JSON must be an array.');
  }

  const directory = new Map<string, UserIdentity>();

  for (const entry of parsed) {
    const candidate = entry as Partial<UserDirectoryEntry>;
    const email = typeof candidate.email === 'string' ? normalizeEmail(candidate.email) : '';
    const userId = typeof candidate.user_id === 'string' ? candidate.user_id.trim() : '';
    const username = typeof candidate.username === 'string' ? candidate.username.trim() : '';
    const aliasRaw = typeof candidate.alias === 'string' ? candidate.alias : username;
    const alias = normalizeAlias(aliasRaw);
    const roleRaw = typeof candidate.role === 'string' ? candidate.role.trim().toLowerCase() : 'member';

    if (!email || !email.includes('@')) {
      throw new Error('USER_DIRECTORY_JSON contains invalid email value.');
    }

    if (!USER_ID_PATTERN.test(userId)) {
      throw new Error('USER_DIRECTORY_JSON contains invalid user_id value.');
    }

    if (!USERNAME_PATTERN.test(username)) {
      throw new Error('USER_DIRECTORY_JSON contains invalid username value.');
    }

    if (!ALIAS_PATTERN.test(alias)) {
      throw new Error('USER_DIRECTORY_JSON contains invalid alias value.');
    }

    if (!ROLE_VALUES.has(roleRaw)) {
      throw new Error('USER_DIRECTORY_JSON contains invalid role value.');
    }

    if (directory.has(email)) {
      throw new Error('USER_DIRECTORY_JSON contains duplicate email value.');
    }

    directory.set(email, {
      user_id: userId,
      username,
      alias,
      role: roleRaw as UserIdentity['role']
    });
  }

  return directory;
};

const getDirectory = (env: Env): Map<string, UserIdentity> | null => {
  const raw = env.USER_DIRECTORY_JSON?.trim() || '';
  if (!raw) return null;

  if (cachedDirectory && raw === cachedRaw) {
    return cachedDirectory;
  }

  const parsed = parseDirectory(raw);
  cachedRaw = raw;
  cachedDirectory = parsed;
  return parsed;
};

export const resolveUserIdentity = async (email: string, claims: AccessClaims, env: Env): Promise<UserIdentity> => {
  const directory = getDirectory(env);
  if (directory) {
    const mapped = directory.get(email);
    if (!mapped) {
      throw new Error('No user directory entry for allowlisted email.');
    }
    return mapped;
  }

  const username = getFallbackUsername(claims, email);
  return {
    user_id: await deriveUserId(email),
    username,
    alias: username,
    role: 'member'
  };
};
