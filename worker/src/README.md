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

Use-case lock:
- `worker/src/useCaseLock.ts`
  - Signed `use_case_lock_token` binds a selected profile to a session.
  - `/api/chat/respond` enforces this lock token on subsequent turns.

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
- `MAX_USER_CHARS`
- `MAX_CONTEXT_MESSAGES`
- `MAX_CONTEXT_CHARS`
- `MAX_TURNS`
- `MAX_OUTPUT_TOKENS`
- `OPENAI_TIMEOUT_MS`
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`)

Optional D1 binding (usage tracking + admin stats):
- `USAGE_DB`
  - Table `usage_events` is created lazily by the worker.
  - `/api/chat/respond` writes per-response usage metadata.
  - `/api/chat/admin/usage` returns a rolling summary.

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
