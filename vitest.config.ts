import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [
    {
      name: 'vitest-markdown-as-text',
      enforce: 'pre',
      load(id) {
        if (!id.endsWith('.md')) return null;
        const content = readFileSync(id, 'utf-8');
        return `export default ${JSON.stringify(content)};`;
      }
    }
  ],
  test: {
    include: ['worker/test/**/*.spec.ts'],
    environment: 'node',
    fileParallelism: false
  }
});
