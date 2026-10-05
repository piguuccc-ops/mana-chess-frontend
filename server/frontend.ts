// ─────────────────────────────────────────────────────────────────────────────
// `node frontend.mjs` – serves the game page (mana-chess.html) and nothing else. The page talks
// to a backend whose address the player types in (Online → server address); --backend puts a
// default there, so players of your server need not type it.
//
//   node frontend.mjs                                  port 4545
//   node frontend.mjs --port 4546
//   node frontend.mjs --backend https://chess-api.example.com
//   node frontend.mjs --game path/to/mana-chess.html   another build of the game
//   node frontend.mjs --no-open                         do not open the browser
//
// The same as environment variables (Docker): PORT, HOST, MANA_BACKEND.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRONTEND_PORT = 4545;
/** The backend's default port (DEFAULT_PORT in src/net/protocol.ts – a test keeps them equal). */
export const BACKEND_PORT = 5454;

/** The page with a default backend address filled in (a meta tag the game reads). */
export function withBackend(html: string, backend: string | null): string {
  if (!backend) return html;
  const safe = backend.replace(/[^A-Za-z0-9:/._\-[\]%]/g, '');
  const tag = `<meta name="mana-chess-backend" content="${safe}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
}

/**
 * A strict Content-Security-Policy for the game page: only its own inline script and style block
 * (by hash) run; images and fonts only from data: URLs (all art is generated in the page); requests
 * may go to any backend (the player types its address in). No frames, forms, plugins or <base>.
 */
export function contentPolicy(html: string): string {
  const hashes = (tag: 'script' | 'style') =>
    [...html.matchAll(new RegExp(`<${tag}(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(
      (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
    );
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes('script').join(' ')}`.trim(),
    `style-src 'self' ${hashes('style').join(' ')}`.trim(),
    "img-src 'self' data: blob:",
    // the bots think in a Web Worker started from a Blob (the page's own embedded code)
    "worker-src blob:",
    "font-src 'self' data:",
    "connect-src 'self' *",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};

function lan(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) for (const a of list ?? []) if ((a.family === 'IPv4' || (a.family as unknown) === 4) && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  return [...new Set(out)];
}

export function startFrontend(opts: { port: number; host?: string; gameFile: string; backend: string | null }): Promise<{ server: Server; port: number }> {
  let cached: { mtime: number; html: Buffer; csp: string } | null = null;
  const page = (): { html: Buffer; csp: string } | null => {
    if (!existsSync(opts.gameFile)) return null;
    const mtime = statSync(opts.gameFile).mtimeMs;
    if (!cached || cached.mtime !== mtime) {
      const text = withBackend(readFileSync(opts.gameFile, 'utf8'), opts.backend);
      cached = { mtime, html: Buffer.from(text), csp: contentPolicy(text) };
    }
    return cached;
  };
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const base = SECURITY_HEADERS;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, base);
      res.end();
      return;
    }
    if (path === '/' || path === '/index.html' || path === '/mana-chess.html') {
      const p = page();
      if (!p) {
        res.writeHead(500, { ...base, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('A játékfájl (mana-chess.html) nem található a frontend mellett.');
        return;
      }
      res.writeHead(200, {
        ...base,
        'Content-Security-Policy': p.csp,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(p.html.length),
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : p.html);
      return;
    }
    if (path === '/favicon.ico') {
      res.writeHead(204, base);
      res.end();
      return;
    }
    res.writeHead(404, { ...base, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nincs ilyen oldal. A játék: /');
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port, opts.host ?? '0.0.0.0', () => {
      const a = server.address();
      ok({ server, port: a && typeof a === 'object' ? a.port : opts.port });
    });
  });
}

// ── the command line (only when run as the program, not when imported by the tests) ──
const isMain = typeof process !== 'undefined' && process.argv[1] && /frontend\.(m?js|ts)$/.test(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Használat: node frontend.mjs [--port 4545] [--backend https://…] [--game mana-chess.html] [--no-open]');
    process.exit(0);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const gameFile = resolve(arg('--game') ?? join(here, 'mana-chess.html'));
  const backend = arg('--backend') ?? (process.env.MANA_BACKEND || null);
  const port = Number(arg('--port') ?? process.env.PORT ?? FRONTEND_PORT) || FRONTEND_PORT;
  const container = existsSync('/.dockerenv') || existsSync('/run/.containerenv');
  startFrontend({ port, host: arg('--host') ?? (process.env.HOST || undefined), gameFile, backend })
    .then((s) => {
      const local = `http://localhost:${s.port}`;
      const urls = lan().map((ip) => `http://${ip}:${s.port}`);
      console.log(
        [
          '',
          '  =====================================================',
          '    MANA CHESS játékoldal (frontend) fut',
          '  =====================================================',
          '',
          `  Ezen a gépen:        ${local}`,
          ...(container
            ? [`  Konténerben fut: a böngészőben a szerver gépének címét nyisd meg (pl. http://192.168.1.10:${s.port}),`, '  interneten a https-es címét.']
            : urls.map((u, i) => `  ${i === 0 ? 'A helyi hálózaton:   ' : '                      '}${u}`)),
          '',
          backend
            ? `  Alapértelmezett szerver a játékban: ${backend}`
            : `  Ha a backend ugyanezen a gépen fut (${BACKEND_PORT}-es port), a játék magától megtalálja;\n  különben a játék Online részénél kell megadni a címét (ip:port vagy https://…).`,
          existsSync(gameFile) ? `  Játékfájl: ${gameFile}` : `  FIGYELEM: nincs játékfájl: ${gameFile}`,
          container ? '  Leállítás: docker compose stop' : '  Leállítás: Ctrl+C (vagy zárd be ezt az ablakot)',
          '',
        ].join('\n'),
      );
      if (!args.includes('--no-open')) {
        try {
          const [cmd, cmdArgs] = process.platform === 'win32' ? ['explorer.exe', [local]] : process.platform === 'darwin' ? ['open', [local]] : ['xdg-open', [local]];
          const child = spawn(cmd as string, cmdArgs as string[], { stdio: 'ignore', detached: true, windowsHide: true });
          child.on('error', () => {});
          child.unref();
        } catch {
          /* no browser */
        }
      }
      const stop = () => s.server.close(() => process.exit(0));
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    })
    .catch((e: NodeJS.ErrnoException) => {
      console.error(e.code === 'EADDRINUSE' ? `\n  A(z) ${port}. port foglalt. Próbáld: node frontend.mjs --port ${port + 1}\n` : `\n  A frontend nem indult el: ${e.message}\n`);
      process.exit(1);
    });
}
