# Hacker Portfolio (GitHub Pages Ready)

This folder is now a standalone React + Vite project that can be deployed to GitHub Pages.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Put this project at the root of your GitHub repo (or use this folder as a separate repo).
2. Push to `main`.
3. In GitHub repo settings:
   - Open `Settings -> Pages`
   - Under `Build and deployment`, select `Source: GitHub Actions`
4. The workflow at `.github/workflows/deploy.yml` will build and deploy automatically.

Important:
- GitHub Actions only reads workflows from the repository root `.github/workflows/`.
- If `NEW` remains a subfolder inside a larger repo, move `NEW/.github/workflows/deploy.yml` to the root `.github/workflows/` and set the workflow `working-directory` to `NEW` for install/build steps.

## Notes

- `vite.config.ts` auto-selects `base`:
  - `"/"` for user-site repos like `username.github.io`
  - `"/repo-name/"` for project-site repos
- Core app entry is `src/main.tsx` and `src/App.tsx`.
- Main styling is in `src/styles/globals.css`.

## Private Chat On GitHub Pages

Because GitHub Pages is static-only, the chat API must run on a separate backend origin (Cloudflare Worker).

1. Add a `.env` file for frontend runtime config:

```bash
VITE_CHAT_API_BASE_URL=https://your-chat-api-domain.com
VITE_CHAT_LOGOUT_URL=https://your-chat-api-domain.com/cdn-cgi/access/logout
```

2. In your Worker config, allow this frontend origin for CORS:

```bash
ALLOWED_ORIGINS=https://bharaths97.github.io
```

3. Open private chat on GitHub Pages with hash routing:

```text
https://bharaths97.github.io/#/chat
```

Notes:
- Direct `/chat` paths depend on hosting-level SPA fallback. GitHub Pages does not provide this by default.
- The OpenAI key stays server-side in Worker secrets only.
