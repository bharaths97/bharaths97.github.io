# Worker API

Endpoints:
- `GET /api/chat/login`
- `GET /api/chat/session`
- `POST /api/chat/respond`
- `POST /api/chat/reset`
- `GET /api/chat/admin/usage` (admin role only)

Prompt profiles (server-only):
- `worker/src/prompts/Gen.md`
- `worker/src/prompts/Cat.md`
- `worker/src/prompts/Upsc.md`
- `worker/src/prompts/index.ts`
  - Edit profile IDs and `displayName` values in this file.
  - Frontend selector labels come from `displayName`.
  - Prompt text is loaded from markdown files and never sent to frontend.
  - Keep markdown files non-sensitive for public repos.
  - Set real prompt content via Worker runtime secrets/vars:
    - `USE_CASE_PROMPT_GEN`
    - `USE_CASE_PROMPT_CAT`
    - `USE_CASE_PROMPT_UPSC`

Tiered memory prompt assets (server-only):
- `worker/src/memory/prompts/ChatContextTemplate.md`
- `worker/src/memory/prompts/Summarizer.md`
- `worker/src/memory/prompts/chatContext.ts`
- `worker/src/memory/prompts/summarizer.ts`
  - Markdown files are bundled in worker only and are never served to frontend.
  - For public repos, keep markdown defaults generic and use env var overrides for sensitive prompt text.

Use-case lock:
- `worker/src/useCaseLock.ts`
  - Signed `use_case_lock_token` binds selected profile + memory mode to a session.
  - `/api/chat/respond` enforces this lock token on subsequent turns.

Memory modes:
- Central definitions: `worker/src/memoryModes.ts`
- Central runtime config aggregation: `worker/src/runtimeConfig.ts`
- Modes exposed to frontend via `/api/chat/session`:
  - `classic` (tiered context off)
  - `tiered` (tiered context on)
- First turn defaults if not supplied:
  - `use_case_id = gen`
  - `memory_mode = classic`

Required secrets:
- `OPENAI_API_KEY`
- `SESSION_HMAC_SECRET`

Required vars:
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_API_AUD`
- `ALLOWED_ORIGINS`
- `ALLOWED_EMAILS`

Optional vars:
- `USER_DIRECTORY_JSON` (recommended for stable `user_id`/`username`/`role` mapping)
- `OPENAI_MODEL`
- `OPENAI_TEMPERATURE`
- `MAX_USER_CHARS`
- `MAX_CONTEXT_MESSAGES`
- `MAX_CONTEXT_CHARS`
- `MAX_TURNS`
- `MAX_OUTPUT_TOKENS`
- `OPENAI_TIMEOUT_MS`
- `ENABLE_TIERED_MEMORY`
- `OPENAI_SUMMARIZER_MODEL`
- `OPENAI_SUMMARIZER_TEMPERATURE`
- `OPENAI_SUMMARIZER_TIMEOUT_MS`
- `OPENAI_SUMMARIZER_MAX_OUTPUT_TOKENS`
- `TIERED_MEMORY_SUMMARIZER_PROMPT`
- `MEMORY_MAX_BASE_TRUTH_ENTRIES`
- `MEMORY_MAX_TURN_LOG_ENTRIES`
- `MEMORY_MAX_RAW_WINDOW_MESSAGES`
- `MEMORY_MAX_FACT_CHARS`
- `MEMORY_MAX_SUMMARY_CHARS`
- `MEMORY_MAX_RAW_MESSAGE_CHARS`
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`)

Optional D1 binding (usage tracking + admin stats):
- `USAGE_DB`
  - Table `usage_events` is created lazily by the worker.
  - `/api/chat/respond` writes per-response usage metadata.
  - `/api/chat/admin/usage` returns a rolling summary with:
    - totals by mode (`classic`, `tiered`)
    - per-user mode breakdown.

Optional rate limit bindings:
- `RESPOND_BURST_LIMITER`
- `RESPOND_MINUTE_LIMITER`

Logging:
- Structured JSON logs are emitted per request with `request_id`, event type, status metadata, and duration.
- Prompt/response bodies are intentionally not logged.
- View logs via:
  - `wrangler tail --config worker/wrangler.toml --format pretty`
  - Cloudflare Dashboard -> Workers -> your worker -> Logs.
- Correlate API errors with logs using `error.request_id` returned in API error JSON.
