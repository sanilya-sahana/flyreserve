import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// FlyReserve web app — SAH-19. Config per SAH-25 ADR.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy to the FlyReserve API. The exact upstream host is owned by DevOps.
    // Default assumes the API is served on :3000 by the sibling apps/api during dev.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
