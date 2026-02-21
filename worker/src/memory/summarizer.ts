import type { Env } from '../types';
import { normalizeBaseTruthDiff } from './diff';
import { classifyTurnComplexity, shouldExtractDiff } from './policy';
import { DEFAULT_SUMMARIZER_SYSTEM_PROMPT } from './prompts/summarizer';

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export interface SummarizeTurnInput {
  userMessage: string;
  assistantMessage: string;
  baseTruth: string[];
  model: string;
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
  maxSummaryChars: number;
  systemPromptOverride?: string;
}

export interface SummarizeTurnResult {
  userSummary: string;
  assistantSummary: string;
  diff: {
    add: string[];
    update: string[];
    remove: string[];
  };
  mode: 'model' | 'fallback';
  complexity: ReturnType<typeof classifyTurnComplexity>;
}

const normalizeText = (value: string, maxChars: number): string => {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxChars);
};

const fallbackSummary = (text: string, maxChars: number): string => {
  const clean = normalizeText(text, maxChars);
  if (!clean) return '(empty)';
  return clean;
};

const extractJsonCandidate = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue extraction attempts.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return '';
};

const parseSummarizerPayload = (
  rawContent: string,
  maxSummaryChars: number
): {
  userSummary: string;
  assistantSummary: string;
  diff: {
    add: string[];
    update: string[];
    remove: string[];
  };
} | null => {
  const candidate = extractJsonCandidate(rawContent);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;

  const userSummary = typeof record.user_summary === 'string' ? normalizeText(record.user_summary, maxSummaryChars) : '';
  const assistantSummary =
    typeof record.assistant_summary === 'string' ? normalizeText(record.assistant_summary, maxSummaryChars) : '';
  const diff = normalizeBaseTruthDiff(record.base_truth_diff, {
    maxFactChars: maxSummaryChars
  });

  if (!userSummary || !assistantSummary) {
    return null;
  }

  return {
    userSummary,
    assistantSummary,
    diff
  };
};

const callSummarizer = async (
  env: Env,
  input: SummarizeTurnInput
): Promise<{
  userSummary: string;
  assistantSummary: string;
  diff: {
    add: string[];
    update: string[];
    remove: string[];
  };
} | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  const payload = {
    model: input.model,
    messages: [
      {
        role: 'system',
        content: input.systemPromptOverride?.trim() || DEFAULT_SUMMARIZER_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            base_truth: input.baseTruth,
            user_message: input.userMessage,
            assistant_reply: input.assistantMessage
          },
          null,
          2
        )
      }
    ],
    temperature: input.temperature,
    max_completion_tokens: input.maxOutputTokens
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) return null;
    const data = (await response.json()) as OpenAIChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content) return null;

    return parseSummarizerPayload(content, input.maxSummaryChars);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const summarizeTurn = async (env: Env, input: SummarizeTurnInput): Promise<SummarizeTurnResult> => {
  const complexity = classifyTurnComplexity(input.userMessage, input.assistantMessage);

  const firstAttempt = await callSummarizer(env, input);
  const parsed = firstAttempt || (await callSummarizer(env, input));

  if (parsed) {
    return {
      userSummary: parsed.userSummary,
      assistantSummary: parsed.assistantSummary,
      diff: shouldExtractDiff(complexity)
        ? parsed.diff
        : {
            add: [],
            update: [],
            remove: []
          },
      mode: 'model',
      complexity
    };
  }

  return {
    userSummary: fallbackSummary(input.userMessage, input.maxSummaryChars),
    assistantSummary: fallbackSummary(input.assistantMessage, input.maxSummaryChars),
    diff: {
      add: [],
      update: [],
      remove: []
    },
    mode: 'fallback',
    complexity
  };
};
