import { defineConfig } from 'vitest/config';

// Tests cover the pure glue in src/bloc only. They run in plain Node and do
// not load the IWSDK dev plugin from vite.config.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
