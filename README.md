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
