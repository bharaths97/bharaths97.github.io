import type { ChatRole } from '../types/chat';

export interface ChatSessionResponse {
  ok: boolean;
  session_id: string;
  user: {
    email: string;
    display_name: string;
  };
  expires_at: string;
  limits?: {
    max_turns?: number;
    max_user_chars?: number;
    max_context_messages?: number;
  };
}

export interface ChatRespondRequestMessage {
  role: ChatRole;
  content: string;
  ts: string;
}

export interface ChatRespondRequest {
  session_id: string;
  messages: ChatRespondRequestMessage[];
}

export interface ChatRespondResponse {
  ok: boolean;
  assistant_message: {
    role: 'assistant';
    content: string;
    ts: string;
  };
  usage?: {
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
  };
  session?: {
    session_id: string;
    expires_at: string;
  };
}

interface ApiErrorPayload {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
}

export class ChatApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const parseError = async (response: Response): Promise<ChatApiError> => {
  let message = 'Request failed.';
  let code = 'UNKNOWN';
  let requestId: string | undefined;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    message = payload.error?.message || message;
    code = payload.error?.code || code;
    requestId = payload.error?.request_id;
  } catch {
    // Ignore parse errors and use fallback error values.
  }

  return new ChatApiError(message, response.status, code, requestId);
};

const request = async <T>(input: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const getChatSession = async (): Promise<ChatSessionResponse> => {
  return request<ChatSessionResponse>('/api/chat/session', { method: 'GET' });
};

export const postChatRespond = async (payload: ChatRespondRequest): Promise<ChatRespondResponse> => {
  return request<ChatRespondResponse>('/api/chat/respond', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const postChatReset = async (sessionId: string): Promise<void> => {
  return request<void>('/api/chat/reset', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  });
};
