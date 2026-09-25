import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~500 kB minified
    chunkSizeWarningLimit: 1000,
  },
});
