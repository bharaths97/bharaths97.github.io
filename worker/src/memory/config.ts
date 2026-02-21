import type { Env } from '../types';
import { DEFAULT_MEMORY_STORE_LIMITS, type MemoryStoreLimits } from './types';

export interface TieredMemoryConfig {
  enabled: boolean;
  storeLimits: MemoryStoreLimits;
}

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseIntBounded = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const getTieredMemoryConfig = (env: Env): TieredMemoryConfig => {
  return {
    enabled: parseBool(env.ENABLE_TIERED_MEMORY, false),
    storeLimits: {
      maxBaseTruthEntries: parseIntBounded(
        env.MEMORY_MAX_BASE_TRUTH_ENTRIES,
        DEFAULT_MEMORY_STORE_LIMITS.maxBaseTruthEntries,
        1,
        5000
      ),
      maxTurnLogEntries: parseIntBounded(
        env.MEMORY_MAX_TURN_LOG_ENTRIES,
        DEFAULT_MEMORY_STORE_LIMITS.maxTurnLogEntries,
        1,
        10000
      ),
      maxRawWindowMessages: parseIntBounded(
        env.MEMORY_MAX_RAW_WINDOW_MESSAGES,
        DEFAULT_MEMORY_STORE_LIMITS.maxRawWindowMessages,
        2,
        200
      ),
      maxFactChars: parseIntBounded(
        env.MEMORY_MAX_FACT_CHARS,
        DEFAULT_MEMORY_STORE_LIMITS.maxFactChars,
        8,
        10000
      ),
      maxSummaryChars: parseIntBounded(
        env.MEMORY_MAX_SUMMARY_CHARS,
        DEFAULT_MEMORY_STORE_LIMITS.maxSummaryChars,
        8,
        12000
      ),
      maxRawMessageChars: parseIntBounded(
        env.MEMORY_MAX_RAW_MESSAGE_CHARS,
        DEFAULT_MEMORY_STORE_LIMITS.maxRawMessageChars,
        32,
        100000
      )
    }
  };
};
