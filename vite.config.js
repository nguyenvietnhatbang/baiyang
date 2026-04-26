import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  /** Luôn đọc `.env` cạnh file vite.config (tránh lệch cwd khi chạy lệnh từ thư mục khác). */
  envDir: __dirname,
  plugins: [react()],
  build: {
    cssMinify: 'esbuild',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
