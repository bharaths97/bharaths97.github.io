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
  ENABLE_TIERED_MEMORY?: string;
  OPENAI_SUMMARIZER_MODEL?: string;
  OPENAI_SUMMARIZER_TIMEOUT_MS?: string;
  OPENAI_SUMMARIZER_TEMPERATURE?: string;
  OPENAI_SUMMARIZER_MAX_OUTPUT_TOKENS?: string;
  TIERED_MEMORY_SUMMARIZER_PROMPT?: string;
  MEMORY_MAX_BASE_TRUTH_ENTRIES?: string;
  MEMORY_MAX_TURN_LOG_ENTRIES?: string;
  MEMORY_MAX_RAW_WINDOW_MESSAGES?: string;
  MEMORY_MAX_FACT_CHARS?: string;
  MEMORY_MAX_SUMMARY_CHARS?: string;
  MEMORY_MAX_RAW_MESSAGE_CHARS?: string;
  OPENAI_MODEL?: string;
  OPENAI_TEMPERATURE?: string;
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
export type ChatMemoryMode = 'classic' | 'tiered';

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
  selected_memory_mode: ChatMemoryMode | null;
  use_case_locked: boolean;
  memory_modes: Array<{
    id: ChatMemoryMode;
    display_name: string;
  }>;
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
  memory_mode?: ChatMemoryMode;
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
    memory_mode: ChatMemoryMode;
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
  totals_by_mode: {
    classic: {
      requests: number;
      input_tokens: number;
      output_tokens: number;
    };
    tiered: {
      requests: number;
      input_tokens: number;
      output_tokens: number;
    };
  };
  users: Array<{
    user_id: string;
    username: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    mode_breakdown: {
      classic: {
        requests: number;
        input_tokens: number;
        output_tokens: number;
      };
      tiered: {
        requests: number;
        input_tokens: number;
        output_tokens: number;
      };
    };
    last_seen: string | null;
  }>;
}
