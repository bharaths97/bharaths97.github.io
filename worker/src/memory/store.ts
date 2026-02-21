import {
  DEFAULT_MEMORY_STORE_LIMITS,
  type MemoryStoreLimits,
  type SessionMemoryState,
  type MemoryTurnSummary,
  type MemoryRawMessage
} from './types';

const sessionStore = new Map<string, SessionMemoryState>();

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeText = (value: string, maxChars: number): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.slice(0, clamp(maxChars, 1, 32_000));
};

const normalizeIsoTs = (value: string | undefined): string => {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
};

const normalizeLimits = (limits?: Partial<MemoryStoreLimits>): MemoryStoreLimits => ({
  maxBaseTruthEntries: clamp(
    limits?.maxBaseTruthEntries ?? DEFAULT_MEMORY_STORE_LIMITS.maxBaseTruthEntries,
    1,
    2000
  ),
  maxTurnLogEntries: clamp(
    limits?.maxTurnLogEntries ?? DEFAULT_MEMORY_STORE_LIMITS.maxTurnLogEntries,
    1,
    5000
  ),
  maxRawWindowMessages: clamp(
    limits?.maxRawWindowMessages ?? DEFAULT_MEMORY_STORE_LIMITS.maxRawWindowMessages,
    2,
    200
  ),
  maxFactChars: clamp(limits?.maxFactChars ?? DEFAULT_MEMORY_STORE_LIMITS.maxFactChars, 8, 10_000),
  maxSummaryChars: clamp(limits?.maxSummaryChars ?? DEFAULT_MEMORY_STORE_LIMITS.maxSummaryChars, 8, 12_000),
  maxRawMessageChars: clamp(
    limits?.maxRawMessageChars ?? DEFAULT_MEMORY_STORE_LIMITS.maxRawMessageChars,
    32,
    100_000
  )
});

const assertSessionIdentifiers = (sessionId: string, userId: string): void => {
  if (!sessionId?.trim()) throw new Error('sessionId is required.');
  if (!userId?.trim()) throw new Error('userId is required.');
};

const dedupePreserveOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(value);
  }

  return deduped;
};

const trimArrayToMax = <T>(values: T[], maxEntries: number): T[] => {
  if (values.length <= maxEntries) return values;
  return values.slice(values.length - maxEntries);
};

const touch = (state: SessionMemoryState): void => {
  state.revision += 1;
  state.lastUpdatedTs = new Date().toISOString();
};

export const createMemoryKey = (sessionId: string, userId: string): string => {
  const normalizedSession = sessionId.trim();
  const normalizedUser = userId.trim();
  return `${normalizedUser}::${normalizedSession}`;
};

export const getSessionMemory = (
  sessionId: string,
  userId: string,
  nowMs = Date.now()
): SessionMemoryState | null => {
  assertSessionIdentifiers(sessionId, userId);
  const key = createMemoryKey(sessionId, userId);
  const existing = sessionStore.get(key);
  if (!existing) return null;

  if (existing.expiresAtMs <= nowMs) {
    sessionStore.delete(key);
    return null;
  }

  return existing;
};

export const getOrCreateSessionMemory = (options: {
  sessionId: string;
  userId: string;
  expiresAtMs: number;
  limits?: Partial<MemoryStoreLimits>;
}): SessionMemoryState => {
  const { sessionId, userId, expiresAtMs } = options;
  assertSessionIdentifiers(sessionId, userId);

  const nowMs = Date.now();
  evictExpiredSessions(nowMs);

  const safeExpiry = Math.max(nowMs + 1_000, expiresAtMs);
  const key = createMemoryKey(sessionId, userId);
  const existing = sessionStore.get(key);
  if (existing && existing.expiresAtMs > nowMs) {
    existing.expiresAtMs = Math.max(existing.expiresAtMs, safeExpiry);
    return existing;
  }

  const memory: SessionMemoryState = {
    key,
    sessionId: sessionId.trim(),
    userId: userId.trim(),
    expiresAtMs: safeExpiry,
    revision: 0,
    baseTruth: [],
    turnLog: [],
    rawWindow: [],
    lastUpdatedTs: new Date().toISOString()
  };

  sessionStore.set(key, memory);
  return memory;
};

export const setSessionBaseTruth = (
  state: SessionMemoryState,
  facts: string[],
  limits?: Partial<MemoryStoreLimits>
): string[] => {
  const safeLimits = normalizeLimits(limits);
  const normalized = facts
    .map((value) => normalizeText(value, safeLimits.maxFactChars))
    .filter(Boolean);

  state.baseTruth = trimArrayToMax(dedupePreserveOrder(normalized), safeLimits.maxBaseTruthEntries);
  touch(state);
  return state.baseTruth;
};

export const appendSessionTurnSummary = (
  state: SessionMemoryState,
  summary: {
    userSummary: string;
    assistantSummary: string;
    ts?: string;
  },
  limits?: Partial<MemoryStoreLimits>
): MemoryTurnSummary => {
  const safeLimits = normalizeLimits(limits);

  const nextTurn = (state.turnLog[state.turnLog.length - 1]?.turn || 0) + 1;
  const entry: MemoryTurnSummary = {
    turn: nextTurn,
    user_summary: normalizeText(summary.userSummary, safeLimits.maxSummaryChars),
    assistant_summary: normalizeText(summary.assistantSummary, safeLimits.maxSummaryChars),
    ts: normalizeIsoTs(summary.ts)
  };

  state.turnLog.push(entry);
  state.turnLog = trimArrayToMax(state.turnLog, safeLimits.maxTurnLogEntries);
  touch(state);
  return entry;
};

export const appendSessionRawExchange = (
  state: SessionMemoryState,
  exchange: {
    userMessage: string;
    assistantMessage: string;
    userTs?: string;
    assistantTs?: string;
  },
  limits?: Partial<MemoryStoreLimits>
): MemoryRawMessage[] => {
  const safeLimits = normalizeLimits(limits);

  const userEntry: MemoryRawMessage = {
    role: 'user',
    content: normalizeText(exchange.userMessage, safeLimits.maxRawMessageChars),
    ts: normalizeIsoTs(exchange.userTs)
  };
  const assistantEntry: MemoryRawMessage = {
    role: 'assistant',
    content: normalizeText(exchange.assistantMessage, safeLimits.maxRawMessageChars),
    ts: normalizeIsoTs(exchange.assistantTs)
  };

  state.rawWindow.push(userEntry, assistantEntry);
  state.rawWindow = trimArrayToMax(state.rawWindow, safeLimits.maxRawWindowMessages);
  touch(state);
  return state.rawWindow;
};

export const clearSessionMemory = (sessionId: string, userId: string): boolean => {
  assertSessionIdentifiers(sessionId, userId);
  const key = createMemoryKey(sessionId, userId);
  return sessionStore.delete(key);
};

export const evictExpiredSessions = (nowMs = Date.now()): number => {
  let removed = 0;

  for (const [key, value] of sessionStore.entries()) {
    if (value.expiresAtMs <= nowMs) {
      sessionStore.delete(key);
      removed += 1;
    }
  }

  return removed;
};

export const getSessionStoreStats = (): {
  sessions: number;
  totalBaseTruthEntries: number;
  totalTurnLogEntries: number;
  totalRawWindowMessages: number;
} => {
  let totalBaseTruthEntries = 0;
  let totalTurnLogEntries = 0;
  let totalRawWindowMessages = 0;

  for (const memory of sessionStore.values()) {
    totalBaseTruthEntries += memory.baseTruth.length;
    totalTurnLogEntries += memory.turnLog.length;
    totalRawWindowMessages += memory.rawWindow.length;
  }

  return {
    sessions: sessionStore.size,
    totalBaseTruthEntries,
    totalTurnLogEntries,
    totalRawWindowMessages
  };
};

export const resetSessionStoreForTests = (): void => {
  sessionStore.clear();
};
