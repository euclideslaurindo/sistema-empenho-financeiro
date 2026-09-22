import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['tests/**', '**/*.config.*', '.next/**', 'node_modules/**'],
    },
  },
});
