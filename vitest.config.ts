import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/services/**',      // Thin wrappers, little value in unit testing
        'src/index.ts',         // Orchestration layer, better tested via E2E
        'src/types/**',         // Type definitions only
        'dist/**'
      ],
      all: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 95,           // Allow minor flexibility for edge cases
        statements: 100
      }
    },
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
    environment: 'node'
  }
})
