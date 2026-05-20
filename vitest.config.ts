import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit-тесты (vitest) живут рядом с кодом: src/**/*.test.ts
// Playwright-тесты — в каталоге tests/, их vitest НЕ трогает.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests', 'e2e'],
    environment: 'node',
  },
});
