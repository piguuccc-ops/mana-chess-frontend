// Builds dist/mana-chess.html: the whole game in one self-contained file (script, styles, fonts
// and art inlined) – open it straight from disk, or serve it with dist/frontend.mjs.
//
//   npm run build
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildId } from './build-id.mjs';

// esbuild comes from devDependencies; ESBUILD=<path to esbuild's main.js> can point elsewhere
const { build } = await import(process.env.ESBUILD ?? 'esbuild');
const id = buildId();
const res = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"', __BUILD_ID__: JSON.stringify(id) },
  outdir: 'dist/tmp',
  write: false,
  loader: { '.css': 'css' },
  logLevel: 'warning',
});
let js = '';
let css = '';
for (const f of res.outputFiles) {
  if (f.path.endsWith('.js')) js = f.text;
  if (f.path.endsWith('.css')) css = f.text;
}
// the script sits inside the page: it must not end the <script> element early
js = js.replace(/<\/script/gi, '<\\/script');
const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="theme-color" content="#120c0a">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Mana Chess">',
  '<title>Mana Chess</title>',
  `<style>${css}</style>`,
].join('');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/mana-chess.html', `<!doctype html><html lang="hu"><head>${head}</head><body><div id="root"></div>\n<script>${js}</script></body></html>`);
console.log(`dist/mana-chess.html – js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB, verzió: ${id}`);
