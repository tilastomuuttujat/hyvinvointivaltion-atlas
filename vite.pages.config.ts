import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const TIETO_TITLE = 'Tietoa on enemmän kuin koskaan — mutta mikä muuttuu?';
const TIETO_DESC = 'Seuraa, miten tieto virtaa ymmärrykseksi ja toiminnaksi Suomessa 1850–2050 — ja missä se katkeaa.';
const TIETO_OG = [
  `<meta property="og:title" content="${TIETO_TITLE}">`,
  `<meta property="og:description" content="${TIETO_DESC}">`,
  `<meta property="og:type" content="article">`,
  `<meta name="twitter:card" content="summary_large_image">`,
].join('');

// One bundle, two readers: copy the built entry into /tieto/ with its own head so the
// article visualization is a real page (200 + shareable metadata), not a router state.
const tietoPage = (): Plugin => ({
  name: 'tieto-page',
  apply: 'build',
  writeBundle(options) {
    const out = options.dir;
    if (!out) return;
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const tieto = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${TIETO_TITLE}</title>`)
      .replace(/<meta name="description"[\s\S]*?>/, `<meta name="description" content="${TIETO_DESC}">`)
      .replace('</head>', `${TIETO_OG}</head>`);
    mkdirSync(join(out, 'tieto'), { recursive: true });
    writeFileSync(join(out, 'tieto', 'index.html'), tieto);
  },
});

export default defineConfig({
  root: local('./pages'),
  base: process.env.PAGES_BASE_PATH || '/hyvinvointivaltion-atlas/',
  publicDir: local('./public'),
  plugins: [react(), tailwindcss(), tietoPage()],
  resolve: { alias: [
    { find: '@/lib/atlas.functions', replacement: local('./src/lib/atlas.static.ts') },
    { find: '@', replacement: local('./src') },
  ] },
  build: { outDir: local('./dist-pages'), emptyOutDir: true },
});
