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

Optional rate limit bindings:
- `RESPOND_BURST_LIMITER`
- `RESPOND_MINUTE_LIMITER`

Notes:
- Auth is enforced with Cloudflare Access JWT validation in `src/access.ts`.
- `/respond` includes validation, optional rate limiting, and upstream timeout controls.
- See root `WORKER.md` for file-level architecture details.
