export type MemoryRole = 'user' | 'assistant';

export interface MemoryRawMessage {
  role: MemoryRole;
  content: string;
  ts: string;
}

export interface MemoryTurnSummary {
  turn: number;
  user_summary: string;
  assistant_summary: string;
  ts: string;
}

export interface BaseTruthDiff {
  add: string[];
  update: string[];
  remove: string[];
}

export interface SessionMemoryState {
  key: string;
  sessionId: string;
  userId: string;
  expiresAtMs: number;
  revision: number;
  baseTruth: string[];
  turnLog: MemoryTurnSummary[];
  rawWindow: MemoryRawMessage[];
  lastUpdatedTs: string;
}

export interface MemoryStoreLimits {
  maxBaseTruthEntries: number;
  maxTurnLogEntries: number;
  maxRawWindowMessages: number;
  maxFactChars: number;
  maxSummaryChars: number;
  maxRawMessageChars: number;
}

export const DEFAULT_MEMORY_STORE_LIMITS: MemoryStoreLimits = {
  maxBaseTruthEntries: 120,
  maxTurnLogEntries: 300,
  maxRawWindowMessages: 12,
  maxFactChars: 240,
  maxSummaryChars: 360,
  maxRawMessageChars: 4000
};
