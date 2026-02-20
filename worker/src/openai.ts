import type { ChatMessage, Env } from './types';

const SYSTEM_PROMPT =
  'You are a concise assistant for a private portfolio chat. Provide direct, accurate, safe answers. Keep responses short unless asked for detail.';

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

const getModel = (env: Env): string => env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

export const generateAssistantReply = async (
  env: Env,
  messages: ChatMessage[],
  options: {
    maxContextMessages: number;
    maxOutputTokens: number;
  }
): Promise<{
  content: string;
  usage?: {
    model: string;
    input_tokens?: number;
    output_tokens?: number;
  };
}> => {
  const model = getModel(env);
  const context = messages.slice(-options.maxContextMessages);

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...context.map((message) => ({ role: message.role, content: message.content }))
    ],
    temperature: 0.3,
    max_completion_tokens: options.maxOutputTokens
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new UpstreamError('Upstream provider request failed.', 502);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new UpstreamError('Upstream provider returned an empty response.', 502);
  }

  return {
    content,
    usage: {
      model,
      input_tokens: data.usage?.prompt_tokens,
      output_tokens: data.usage?.completion_tokens
    }
  };
};
