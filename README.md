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
- Optional limits (`MAX_*`, timeout, model)

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

1. Unauthenticated API call is blocked by Access.
2. Allowed OTP user can load session and chat.
3. Non-allowlisted user receives forbidden response.
4. Refresh keeps session transcript while token/session is active.
5. Logout clears local transcript and forces re-auth.
6. Session mismatch payload is rejected by Worker.
7. Rate limits trigger expected `429` responses.

---

## File Pointers

- Frontend entry: `src/main.tsx`, `src/App.tsx`
- Chat frontend: `src/pages/ChatPage.tsx`, `src/lib/chatApi.ts`, `src/lib/chatRuntime.ts`
- Worker backend: `worker/src/index.ts` and `worker/src/*`
- Worker internals guide: `WORKER.md`
