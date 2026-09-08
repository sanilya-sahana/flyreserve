import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Vitest config — Gate 5 coverage.
// The LCOV report emitted at apps/web/coverage/lcov.info is consumed by the
// repo-root sonar-project.properties (sonar.javascript.lcov.reportPaths
// includes apps/web/coverage/lcov.info).
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
          // Gate 5 minimum (org-wide 70% floor). Current coverage on
          // feat/sah-19-booking-flow-web-shell is ~99% (see QA review on
          // SAH-40); we set the enforced floor at the Gate 5 minimum so
          // future placeholder additions cannot silently regress below it.
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  }),
);
