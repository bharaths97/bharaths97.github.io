import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendSessionRawExchange,
  appendSessionTurnSummary,
  clearSessionMemory,
  evictExpiredSessions,
  getOrCreateSessionMemory,
  getSessionMemory,
  getSessionStoreStats,
  resetSessionStoreForTests,
  setSessionBaseTruth
} from '../../src/memory/store';

describe('memory store', () => {
  beforeEach(() => {
    resetSessionStoreForTests();
  });

  it('creates and retrieves session memory by session/user key', () => {
    const memory = getOrCreateSessionMemory({
      sessionId: 'sess-1',
      userId: 'user-1',
      expiresAtMs: Date.now() + 10_000
    });

    expect(memory.sessionId).toBe('sess-1');
    expect(memory.userId).toBe('user-1');
    expect(getSessionMemory('sess-1', 'user-1')).toBe(memory);
    expect(getSessionMemory('sess-1', 'user-2')).toBeNull();
  });

  it('evicts expired sessions', () => {
    const expired = getOrCreateSessionMemory({
      sessionId: 'expired',
      userId: 'user-1',
      expiresAtMs: Date.now() + 10_000
    });
    expired.expiresAtMs = Date.now() - 1_000;

    const removed = evictExpiredSessions(Date.now());
    expect(removed).toBe(1);
    expect(getSessionMemory('expired', 'user-1')).toBeNull();

    getOrCreateSessionMemory({
      sessionId: 'active',
      userId: 'user-1',
      expiresAtMs: Date.now() + 10_000
    });
    expect(getSessionMemory('active', 'user-1')).not.toBeNull();
  });

  it('applies caps for base truth, turn log, and raw window', () => {
    const memory = getOrCreateSessionMemory({
      sessionId: 'sess-caps',
      userId: 'user-1',
      expiresAtMs: Date.now() + 10_000
    });

    setSessionBaseTruth(memory, ['A', 'B', 'C', 'D'], { maxBaseTruthEntries: 2 });
    expect(memory.baseTruth).toEqual(['C', 'D']);

    appendSessionTurnSummary(memory, { userSummary: 'u1', assistantSummary: 'a1' }, { maxTurnLogEntries: 2 });
    appendSessionTurnSummary(memory, { userSummary: 'u2', assistantSummary: 'a2' }, { maxTurnLogEntries: 2 });
    appendSessionTurnSummary(memory, { userSummary: 'u3', assistantSummary: 'a3' }, { maxTurnLogEntries: 2 });
    expect(memory.turnLog.map((entry) => entry.turn)).toEqual([2, 3]);

    appendSessionRawExchange(memory, { userMessage: 'u1', assistantMessage: 'a1' }, { maxRawWindowMessages: 4 });
    appendSessionRawExchange(memory, { userMessage: 'u2', assistantMessage: 'a2' }, { maxRawWindowMessages: 4 });
    appendSessionRawExchange(memory, { userMessage: 'u3', assistantMessage: 'a3' }, { maxRawWindowMessages: 4 });
    expect(memory.rawWindow).toHaveLength(4);
    expect(memory.rawWindow[0].content).toBe('u2');
    expect(memory.rawWindow[1].content).toBe('a2');
    expect(memory.rawWindow[2].content).toBe('u3');
    expect(memory.rawWindow[3].content).toBe('a3');
  });

  it('clears targeted session memory and updates stats', () => {
    const memory = getOrCreateSessionMemory({
      sessionId: 'sess-2',
      userId: 'user-2',
      expiresAtMs: Date.now() + 10_000
    });
    appendSessionTurnSummary(memory, { userSummary: 'u', assistantSummary: 'a' });

    const before = getSessionStoreStats();
    expect(before.sessions).toBe(1);
    expect(before.totalTurnLogEntries).toBe(1);

    expect(clearSessionMemory('sess-2', 'user-2')).toBe(true);

    const after = getSessionStoreStats();
    expect(after.sessions).toBe(0);
  });
});
