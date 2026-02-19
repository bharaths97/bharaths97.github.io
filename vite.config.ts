import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserPagesRepo = repository.endsWith('.github.io');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isUserPagesRepo ? '/' : repository ? `/${repository}/` : '/'
});
