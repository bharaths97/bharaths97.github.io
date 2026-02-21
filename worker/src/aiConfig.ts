import type { Env } from './types';

export interface ChatModelRuntimeConfig {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface SummarizerRuntimeConfig {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
  systemPromptOverride: string;
}

export interface AiRuntimeConfig {
  chat: ChatModelRuntimeConfig;
  summarizer: SummarizerRuntimeConfig;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const parseIntBounded = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const parseFloatBounded = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseFloat(value || '');
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const normalizeModel = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized || fallback;
};

export const getAiRuntimeConfig = (env: Env): AiRuntimeConfig => {
  const defaultModel = normalizeModel(env.OPENAI_MODEL, 'gpt-4o-mini');
  const defaultMaxOutputTokens = parseIntBounded(env.MAX_OUTPUT_TOKENS, 400, 50, 4000);

  return {
    chat: {
      model: defaultModel,
      temperature: parseFloatBounded(env.OPENAI_TEMPERATURE, 0.3, 0, 2),
      timeoutMs: parseIntBounded(env.OPENAI_TIMEOUT_MS, 15000, 1000, 60000),
      maxOutputTokens: defaultMaxOutputTokens
    },
    summarizer: {
      model: normalizeModel(env.OPENAI_SUMMARIZER_MODEL, defaultModel),
      temperature: parseFloatBounded(env.OPENAI_SUMMARIZER_TEMPERATURE, 0.1, 0, 2),
      timeoutMs: parseIntBounded(env.OPENAI_SUMMARIZER_TIMEOUT_MS, 8000, 1000, 60000),
      maxOutputTokens: parseIntBounded(env.OPENAI_SUMMARIZER_MAX_OUTPUT_TOKENS, 400, 50, 4000),
      systemPromptOverride: env.TIERED_MEMORY_SUMMARIZER_PROMPT?.trim() || ''
    }
  };
};
