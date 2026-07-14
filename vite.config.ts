import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBase = process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/';

export default defineConfig({
  plugins: [react()],
  // GitHub Actions 自动从 owner/repo 推导 Pages 子路径；本地预览保持根路径。
  base: pagesBase,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
