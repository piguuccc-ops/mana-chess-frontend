import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `npm run dev`  – development server with hot reload (http://localhost:5173)
// `npm run build` – the single-file game (scripts/build-single.mjs) and its page server
export default defineConfig({
  plugins: [react()],
  base: './',
  // a development page is not an official build: every backend lets it in
  define: { __BUILD_ID__: JSON.stringify('dev') },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
