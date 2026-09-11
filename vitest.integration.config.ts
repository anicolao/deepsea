import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/integration/**/*.test.ts'], testTimeout: 2000, hookTimeout: 10000, retry: 0, fileParallelism: false } });
