import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { nitro } from 'nitro/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: 'apps/web',
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@nx-temp/data': `${workspaceRoot}/libs/data/src/index.ts`,
      '@nx-temp/auth': `${workspaceRoot}/libs/auth/src/index.ts`,
      '@nx-temp/ai': `${workspaceRoot}/libs/ai/src/index.ts`,
    },
  },
  server: {
    port: 4300,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
  plugins: [
    tsconfigPaths({
      projects: [
        `${workspaceRoot}/apps/web/tsconfig.json`,
        `${workspaceRoot}/tsconfig.base.json`,
      ],
    }),
    tanstackStart({
      srcDirectory: 'src',
      router: { routeFileIgnorePattern: '__tests__' },
    }),
    react(),
    nitro(),
  ],
});
