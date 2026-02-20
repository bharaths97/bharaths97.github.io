interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  OPENAI_API_KEY: string;
  SESSION_HMAC_SECRET: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_API_AUD: string;
  ALLOWED_ORIGINS: string;
  ALLOWED_EMAILS: string;
  OPENAI_MODEL?: string;
  MAX_USER_CHARS?: string;
  MAX_CONTEXT_MESSAGES?: string;
  MAX_CONTEXT_CHARS?: string;
  MAX_TURNS?: string;
  MAX_OUTPUT_TOKENS?: string;
  OPENAI_TIMEOUT_MS?: string;
  LOG_LEVEL?: string;
  RESPOND_BURST_LIMITER?: RateLimiterBinding;
  RESPOND_MINUTE_LIMITER?: RateLimiterBinding;
}

export interface AccessClaims {
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  sub: string;
  email?: string;
  name?: string;
  identity_nonce?: string;
}

export interface AuthContext {
  claims: AccessClaims;
  email: string;
  displayName: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: string;
}

export interface ChatSessionResponse {
  ok: true;
  session_id: string;
  user: {
    email: string;
    display_name: string;
  };
  expires_at: string;
  limits: {
    max_turns: number;
    max_user_chars: number;
    max_context_messages: number;
  };
}

export interface ChatRespondRequest {
  session_id: string;
  messages: ChatMessage[];
}

export interface ChatRespondResponse {
  ok: true;
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
  session: {
    session_id: string;
    expires_at: string;
  };
}
