import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const blockInternalDocsPlugin = (): Plugin => {
  const blockRequest = (url: string | undefined): boolean => {
    if (!url) return false;
    const pathname = url.split('?')[0] || '/';
    return pathname === '/docs' || pathname.startsWith('/docs/');
  };

  const middleware = (req: { url?: string }, res: { statusCode: number; end: (body?: string) => void }, next: () => void) => {
    if (blockRequest(req.url)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    next();
  };

  return {
    name: 'block-internal-docs',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), blockInternalDocsPlugin()],
  // Relative asset paths make the build resilient on both user and project Pages URLs.
  base: './'
});
