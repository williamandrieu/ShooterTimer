import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/domain/**',
        'src/application/**',
        'src/ports/**',
        'src/validation/**',
        'src/infra/storage/**',
        'src/infra/audio/micConstraints.ts',
        'src/infra/audio/micPermission.ts',
        'src/infra/audio/beep.ts',
        'src/infra/audio/wakeLock.ts',
        'src/infra/audio/shotDetectorAdapter.ts',
        'src/i18n/index.ts',
        'src/hooks/**',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**', '**/*.worklet.ts'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
