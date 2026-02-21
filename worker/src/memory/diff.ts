import { DEFAULT_MEMORY_STORE_LIMITS, type BaseTruthDiff } from './types';

interface NormalizeDiffOptions {
  maxEntriesPerOperation?: number;
  maxFactChars?: number;
}

interface ApplyDiffOptions {
  maxBaseTruthEntries?: number;
  maxFactChars?: number;
}

interface DiffStats {
  removed: number;
  updated: number;
  added: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeFact = (value: string, maxChars: number): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.slice(0, clamp(maxChars, 8, 10_000));
};

const normalizeStringArray = (value: unknown, maxEntries: number, maxFactChars: number): string[] => {
  if (!Array.isArray(value)) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = normalizeFact(item, maxFactChars);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);

    if (normalized.length >= maxEntries) break;
  }

  return normalized;
};

const getUpdateKey = (fact: string): string => {
  const colonIndex = fact.indexOf(':');
  const prefix = colonIndex > 0 ? fact.slice(0, colonIndex) : fact.slice(0, 48);
  return prefix.trim().toLowerCase();
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }

  return deduped;
};

export const normalizeBaseTruthDiff = (
  input: unknown,
  options: NormalizeDiffOptions = {}
): BaseTruthDiff => {
  const maxEntries = clamp(options.maxEntriesPerOperation ?? 30, 1, 200);
  const maxFactChars = clamp(options.maxFactChars ?? DEFAULT_MEMORY_STORE_LIMITS.maxFactChars, 8, 10_000);

  if (!input || typeof input !== 'object') {
    return { add: [], update: [], remove: [] };
  }

  const raw = input as Record<string, unknown>;
  return {
    add: normalizeStringArray(raw.add, maxEntries, maxFactChars),
    update: normalizeStringArray(raw.update, maxEntries, maxFactChars),
    remove: normalizeStringArray(raw.remove, maxEntries, maxFactChars)
  };
};

export const applyBaseTruthDiff = (
  baseTruth: string[],
  diff: BaseTruthDiff,
  options: ApplyDiffOptions = {}
): {
  nextBaseTruth: string[];
  stats: DiffStats;
} => {
  const maxFactChars = clamp(options.maxFactChars ?? DEFAULT_MEMORY_STORE_LIMITS.maxFactChars, 8, 10_000);
  const maxEntries = clamp(
    options.maxBaseTruthEntries ?? DEFAULT_MEMORY_STORE_LIMITS.maxBaseTruthEntries,
    1,
    5000
  );

  let next = dedupe(baseTruth.map((value) => normalizeFact(value, maxFactChars)).filter(Boolean));
  const stats: DiffStats = {
    removed: 0,
    updated: 0,
    added: 0
  };

  const removeTokens = diff.remove.map((value) => value.toLowerCase());
  if (removeTokens.length > 0) {
    const before = next.length;
    next = next.filter((fact) => !removeTokens.some((token) => fact.toLowerCase().includes(token)));
    stats.removed = before - next.length;
  }

  for (const replacementRaw of diff.update) {
    const replacement = normalizeFact(replacementRaw, maxFactChars);
    if (!replacement) continue;

    const key = getUpdateKey(replacement);
    const index = next.findIndex((fact) => getUpdateKey(fact) === key);
    if (index >= 0) {
      next[index] = replacement;
      stats.updated += 1;
    } else {
      next.push(replacement);
      stats.added += 1;
    }
  }

  for (const factRaw of diff.add) {
    const fact = normalizeFact(factRaw, maxFactChars);
    if (!fact) continue;
    if (next.some((existing) => existing.toLowerCase() === fact.toLowerCase())) continue;
    next.push(fact);
    stats.added += 1;
  }

  next = dedupe(next);
  if (next.length > maxEntries) {
    next = next.slice(next.length - maxEntries);
  }

  return {
    nextBaseTruth: next,
    stats
  };
};
