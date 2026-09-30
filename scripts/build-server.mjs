// Builds dist/frontend.mjs – the small server that hands out the game page (Node.js 18+, no
// node_modules needed to run it) – and puts the Docker health check next to it.
//
//   npm run build        (builds the page too)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const { build } = await import(process.env.ESBUILD ?? 'esbuild');
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['server/frontend.ts'],
  outfile: 'dist/frontend.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node18'],
  legalComments: 'none',
  logLevel: 'warning',
  banner: { js: '// Mana Chess játékoldal (frontend). Indítás: node frontend.mjs – lásd README.' },
});
copyFileSync('docker/healthcheck.mjs', 'dist/healthcheck.mjs');
if (!existsSync('dist/mana-chess.html')) console.warn('Figyelem: nincs még dist/mana-chess.html – előbb: node scripts/build-single.mjs');
console.log('dist/frontend.mjs');
