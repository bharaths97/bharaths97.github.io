import type { ChatMessage, Env } from './types';

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

export const generateAssistantReply = async (
  env: Env,
  messages: ChatMessage[],
  options: {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxContextMessages: number;
    maxOutputTokens: number;
    timeoutMs: number;
  }
): Promise<{
  content: string;
  usage?: {
    model: string;
    input_tokens?: number;
    output_tokens?: number;
  };
}> => {
  const model = options.model.trim() || 'gpt-4o-mini';
  const context = messages.slice(-options.maxContextMessages);

  const payload = {
    model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      ...context.map((message) => ({ role: message.role, content: message.content }))
    ],
    temperature: options.temperature,
    max_completion_tokens: options.maxOutputTokens
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch {
    throw new UpstreamError('Upstream provider request failed.', 502);
  } finally {
    clearTimeout(timeout);
  }

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
