import { describe, expect, it } from 'vitest';
import { getAiRuntimeConfig } from '../src/aiConfig';
import { buildEnv } from './helpers';

describe('ai runtime config', () => {
  it('resolves chat and summarizer defaults from env', () => {
    const env = buildEnv();
    const config = getAiRuntimeConfig(env);

    expect(config.chat.model).toBe('gpt-4o-mini');
    expect(config.chat.temperature).toBe(0.3);
    expect(config.chat.timeoutMs).toBe(15000);
    expect(config.chat.maxOutputTokens).toBe(400);

    expect(config.summarizer.model).toBe('gpt-4o-mini');
    expect(config.summarizer.temperature).toBe(0.1);
    expect(config.summarizer.timeoutMs).toBe(8000);
    expect(config.summarizer.maxOutputTokens).toBe(400);
  });

  it('applies explicit summarizer overrides', () => {
    const env = buildEnv({
      OPENAI_MODEL: 'gpt-4.1-mini',
      OPENAI_TEMPERATURE: '0.55',
      OPENAI_SUMMARIZER_MODEL: 'gpt-4o-mini',
      OPENAI_SUMMARIZER_TEMPERATURE: '0.2',
      OPENAI_SUMMARIZER_TIMEOUT_MS: '12000',
      OPENAI_SUMMARIZER_MAX_OUTPUT_TOKENS: '250',
      TIERED_MEMORY_SUMMARIZER_PROMPT: 'Summarize strictly.'
    });
    const config = getAiRuntimeConfig(env);

    expect(config.chat.model).toBe('gpt-4.1-mini');
    expect(config.chat.temperature).toBe(0.55);
    expect(config.summarizer.model).toBe('gpt-4o-mini');
    expect(config.summarizer.temperature).toBe(0.2);
    expect(config.summarizer.timeoutMs).toBe(12000);
    expect(config.summarizer.maxOutputTokens).toBe(250);
    expect(config.summarizer.systemPromptOverride).toBe('Summarize strictly.');
  });
});
