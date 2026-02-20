# Hacker Portfolio + Private Chat

This repo deploys in two places:
- GitHub Pages: static React frontend (`/` and `#/chat` UI)
- Cloudflare Worker: private chat API backend (`/api/chat/*`)

## Local Development

```bash
npm install
npm run dev
```

Optional frontend env (`.env`):
```bash
VITE_CHAT_API_BASE_URL=https://your-chat-api-domain.com
VITE_CHAT_LOGOUT_URL=https://your-chat-api-domain.com/cdn-cgi/access/logout
```

## Build

```bash
npm run build
npm run preview
```

---

## Deployment Model (What Runs Where)

### GitHub Pages (frontend only)
- Builds Vite app and publishes `dist`.
- Runs from `.github/workflows/deploy.yml`.
- Uses GitHub Actions repository variables:
  - `VITE_CHAT_API_BASE_URL`
  - `VITE_CHAT_LOGOUT_URL` (optional override)

### Cloudflare Worker (backend only)
- Deploys Worker code under `worker/`.
- Runs from `.github/workflows/worker-deploy.yml`.
- Uses Cloudflare API credentials stored as GitHub secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

No OpenAI key is exposed to frontend. OpenAI secret stays in Cloudflare Worker secrets only.

---

## GitHub Pages Setup

1. Enable Pages in repository settings:
   - `Settings -> Pages`
   - Source: `GitHub Actions`

2. Add GitHub Actions repository variables:
   - `VITE_CHAT_API_BASE_URL=https://<your-worker-api-domain>`
   - `VITE_CHAT_LOGOUT_URL=https://<your-worker-api-domain>/cdn-cgi/access/logout` (recommended for full sign-out)

3. Push to `main` to trigger `.github/workflows/deploy.yml`.

4. Access chat route via hash routing on Pages:
   - `https://bharaths97.github.io/#/chat`

Notes:
- Direct `/chat` is not reliable on GitHub Pages (no SPA fallback by default).
- `#/chat` is the correct route for Pages.
- Logout behavior:
  - If `VITE_CHAT_LOGOUT_URL` is Access logout URL, app appends a `returnTo` back to homepage.
  - If not set, app defaults to Access logout on API base URL when available; otherwise `/`.

---

## Cloudflare Worker Setup

### 1) Configure `worker/wrangler.toml`
Set your values for:
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_API_AUD`
- `ALLOWED_ORIGINS` (include `https://bharaths97.github.io`)
- `ALLOWED_EMAILS`
- Optional limits (`MAX_*`, timeout, model) and `LOG_LEVEL`

### 2) Set Worker secrets (Cloudflare)
Required:
- `OPENAI_API_KEY`
- `SESSION_HMAC_SECRET`

You can set these via dashboard or Wrangler secret commands.

### 3) Deploy Worker
Option A (recommended): GitHub Action
- Add GitHub secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Push to `main` (changes under `worker/`) or run workflow manually:
  - `.github/workflows/worker-deploy.yml`

Option B: local deploy with Wrangler from `worker/`.

### 4) Route/API hostname
- Attach Worker to your API hostname/path in Cloudflare.
- Frontend should call that API origin via `VITE_CHAT_API_BASE_URL`.

---

## Cloudflare Access (Manual Auth Testing Stage)

Configure Access after core app flow is stable.

1. Create Access application for your API origin/path (the Worker endpoint surface).
2. Enable OTP login and explicit email allowlist policy.
3. Confirm Access JWT audience matches `ACCESS_API_AUD` in Worker config.
4. Verify only allowed users can call:
   - `GET /api/chat/session`
   - `POST /api/chat/respond`
   - `POST /api/chat/reset`

---

## End-to-End Manual Verification Checklist

Primary flow to validate first (in this exact order):
1. Start unauthenticated and open `https://bharaths97.github.io/#/chat`.
2. Verify redirection/challenge to Cloudflare Access login.
3. Complete OTP login with an allowlisted user.
4. Verify chat loads and `GET /api/chat/session` succeeds.
5. Send at least one message and verify `POST /api/chat/respond` succeeds.
6. Refresh page and confirm transcript/session continuity.
7. Click Logout.
8. Verify redirect back to homepage after Access logout.
9. Re-open `#/chat` and confirm login is required again.
10. Verify previous chat transcript is gone (session destruction + local state cleared).

Additional security checks:
1. Unauthenticated direct API call is blocked by Access.
2. Non-allowlisted user receives forbidden response.
3. Session mismatch payload is rejected by Worker.
4. Rate limits trigger expected `429` responses.

## Recommended Next Steps (Now)

1. Deploy Worker first and confirm `/api/chat/session` returns Access challenge when unauthenticated.
2. Configure Access OTP + allowlist policy for the Worker API route.
3. Deploy frontend with `VITE_CHAT_API_BASE_URL` and `VITE_CHAT_LOGOUT_URL` pointing to Worker/API domain.
4. Execute manual flow in order:
   - redirection -> login -> session -> logout -> redirection -> session destruction.
5. Tail logs during the run and verify expected lifecycle events and `request_id` correlation.

---

## Backend Logging and Troubleshooting

The Worker emits structured JSON logs with a per-request `request_id`.

How to view logs:
1. Local/CLI tail:
   - `wrangler tail --config worker/wrangler.toml --format pretty`
2. Cloudflare dashboard:
   - `Workers & Pages -> your worker -> Logs`

How to correlate a failing API request:
1. Copy `error.request_id` from API error response JSON.
2. Search logs for that `request_id`.
3. Inspect lifecycle events (`request.received`, `chat.*.success`, `request.*_error`).

Log safety notes:
- Prompt and response bodies are not logged.
- Metadata logged includes status code, duration, model, and token usage counts.
- Configure verbosity with `LOG_LEVEL` in Worker vars.

---

## File Pointers

- Frontend entry: `src/main.tsx`, `src/App.tsx`
- Chat frontend: `src/pages/ChatPage.tsx`, `src/lib/chatApi.ts`, `src/lib/chatRuntime.ts`
- Worker backend: `worker/src/index.ts` and `worker/src/*`
- Worker internals guide: `WORKER.md`
- Authenticated architecture doc: `docs/ARCHITECTURE_AUTHENTICATED_V1.md`
- Threat model (current state): `docs/THREAT_MODEL_AUTHENTICATED_V1.md`
- Product roadmap (authenticated-first + guest deferred): `docs/ROADMAP.md`
