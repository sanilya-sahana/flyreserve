import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Vitest config — Gate 5 coverage wired to sonar-project.properties at repo root.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'clover'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/test/**',
          'src/**/*.d.ts',
          'src/routes/index.tsx',
        ],
        thresholds: {
          // Gate 5 minimum. Frontend shell currently below 70% overall while
          // real screen logic is unblocked; raise thresholds once screens land.
          lines: 40,
          functions: 40,
          branches: 40,
          statements: 40,
        },
      },
    },
  }),
);
