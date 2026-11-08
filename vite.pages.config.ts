import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: local('./pages'),
  base: process.env.PAGES_BASE_PATH || '/hyvinvointivaltion-atlas/',
  publicDir: local('./public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: '@/lib/atlas.functions', replacement: local('./src/lib/atlas.static.ts') },
    { find: '@', replacement: local('./src') },
  ] },
  build: { outDir: local('./dist-pages'), emptyOutDir: true },
});
