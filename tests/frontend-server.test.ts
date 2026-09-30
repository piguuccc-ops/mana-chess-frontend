// The game page server (server/frontend.ts): it hands out the one game page and nothing else,
// fills in the default backend, and sends a strict Content-Security-Policy.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKEND_PORT, contentPolicy, FRONTEND_PORT, startFrontend, withBackend } from '../server/frontend';
import { ADMIN_PORT, DEFAULT_PORT } from '../src/net/protocol';

describe('the frontend server', () => {
  it('serves only the page, with the default backend filled in', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mana-fe-'));
    const game = join(dir, 'mana-chess.html');
    writeFileSync(game, '<!doctype html><html><head><title>t</title></head><body>játék</body></html>');
    const fe = await startFrontend({ port: 0, host: '127.0.0.1', gameFile: game, backend: 'https://sakk-api.example.com' });
    try {
      const html = await (await fetch(`http://127.0.0.1:${fe.port}/`)).text();
      expect(html).toContain('<meta name="mana-chess-backend" content="https://sakk-api.example.com">');
      expect((await fetch(`http://127.0.0.1:${fe.port}/api/info`)).status).toBe(404);
      expect(withBackend('<head>', 'https://x.y/"><script>')).not.toContain('<script>');
    } finally {
      fe.server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sends a strict CSP: only the page\'s own inline script and style run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mana-fe-'));
    const game = join(dir, 'mana-chess.html');
    const js = 'console.log("mana")';
    const css = 'body{color:red}';
    writeFileSync(game, `<!doctype html><html><head><style>${css}</style></head><body><script>${js}</script></body></html>`);
    const fe = await startFrontend({ port: 0, host: '127.0.0.1', gameFile: game, backend: null });
    try {
      const res = await fetch(`http://127.0.0.1:${fe.port}/`);
      const csp = res.headers.get('content-security-policy') ?? '';
      const sha = (t: string) => `'sha256-${createHash('sha256').update(t).digest('base64')}'`;
      expect(csp).toContain(`script-src 'self' ${sha(js)}`);
      expect(csp).toContain(`style-src 'self' ${sha(css)}`);
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).not.toContain('unsafe-inline');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(contentPolicy('<script src="/a.js"></script>')).toContain("script-src 'self';");
    } finally {
      fe.server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the ports', () => {
  it('game page 4545, backend 5454, control panel 5555 – and the page server knows the backend\'s', () => {
    expect(FRONTEND_PORT).toBe(4545);
    expect(DEFAULT_PORT).toBe(5454);
    expect(ADMIN_PORT).toBe(5555);
    expect(BACKEND_PORT).toBe(DEFAULT_PORT);
  });
});
