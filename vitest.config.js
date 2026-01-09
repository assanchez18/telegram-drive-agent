import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/**',
        'test/**',
        'scripts/**',
        '*.config.js',
        'DEV.md',
        'Dockerfile',
        'src/index.js',
        'src/auth.js',
        'src/telegram.js',
      ],
      thresholds: {
        statements: 100,
        branches: 90,
        functions: 100,
        lines: 100,
      },
    },
  },
});
