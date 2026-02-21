interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface D1Result<T = unknown> {
  success: boolean;
  error?: string;
  results?: T[];
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

export interface Env {
  OPENAI_API_KEY: string;
  SESSION_HMAC_SECRET: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_API_AUD: string;
  ALLOWED_ORIGINS: string;
  ALLOWED_EMAILS: string;
  USER_DIRECTORY_JSON?: string;
  USE_CASE_PROMPT_GEN?: string;
  USE_CASE_PROMPT_CAT?: string;
  USE_CASE_PROMPT_UPSC?: string;
  OPENAI_MODEL?: string;
  MAX_USER_CHARS?: string;
  MAX_CONTEXT_MESSAGES?: string;
  MAX_CONTEXT_CHARS?: string;
  MAX_TURNS?: string;
  MAX_OUTPUT_TOKENS?: string;
  OPENAI_TIMEOUT_MS?: string;
  LOG_LEVEL?: string;
  USAGE_DB?: D1Database;
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
  identity: {
    user_id: string;
    username: string;
    alias: string;
    role: 'admin' | 'member';
  };
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
    username: string;
  };
  capabilities: {
    control_center: boolean;
  };
  selected_use_case_id: string | null;
  use_case_locked: boolean;
  prompt_profiles: Array<{
    id: string;
    display_name: string;
  }>;
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
  use_case_id?: string;
  use_case_lock_token?: string;
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
    use_case_id: string;
    use_case_locked: boolean;
    use_case_lock_token: string;
  };
}

export interface ChatAdminUsageResponse {
  ok: true;
  window_days: number;
  generated_at: string;
  totals: {
    requests: number;
    input_tokens: number;
    output_tokens: number;
    active_users: number;
  };
  users: Array<{
    user_id: string;
    username: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    last_seen: string | null;
  }>;
}
