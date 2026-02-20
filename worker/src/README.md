# Worker API (Step 4 Scaffold)

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
- `MAX_TURNS`
- `MAX_OUTPUT_TOKENS`
