# Worker API

Endpoints:
- `GET /api/chat/session`
- `POST /api/chat/respond`
- `POST /api/chat/reset`

Required secrets:
- `OPENAI_API_KEY`
- `SESSION_HMAC_SECRET`

Required vars:
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_API_AUD`
- `ALLOWED_ORIGINS`
- `ALLOWED_EMAILS`

Optional vars:
- `OPENAI_MODEL`
- `MAX_USER_CHARS`
- `MAX_CONTEXT_MESSAGES`
- `MAX_CONTEXT_CHARS`
- `MAX_TURNS`
- `MAX_OUTPUT_TOKENS`
- `OPENAI_TIMEOUT_MS`
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`)

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
