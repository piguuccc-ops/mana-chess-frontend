# Mana Chess

Chess with a Clash Royale-style mana and spell system, in the browser. You build a 6-card deck from 71
spells, hold 3 cards at a time, and cycle through them. You gain mana every turn and for every capture.
Everything is drawn in pixel art made in code. The game's own text is in Hungarian.

![A game in progress](docs/screenshot.png)

- **Modes:**
  - local 1v1 on one screen;
  - a simple AI opponent;
  - online play through the [backend](https://github.com/piguuccc-ops/mana-chess-backend).
- **Online with an account:**
  - decks stored on the server;
  - friends, and who is online;
  - challenges that start a game at once;
  - games you can continue on any device.
- **Online as a guest (LAN mode):** no account, decks stay in the browser, rooms by list or four-letter code.
- **Works on phones.** In portrait everything fits on one screen. Landscape has its own layout. It can be
  added to the home screen.
- **One file.** `npm run build` makes `dist/mana-chess.html`, the whole game in a single self-contained
  HTML file. It even runs straight from disk.

The detailed Hungarian documentation (rules, spells, architecture, pixel-art pipeline, balance test) is in
[README.hu.md](README.hu.md). The spell list is in [SPELLS.md](SPELLS.md), and the balance report is in
[BALANCE.md](BALANCE.md).

## This repository

It holds two things:

1. **The game** (`src/`): React 19 + TypeScript. The rules engine (`src/engine/`) is pure TypeScript with
   no React: `applyAction(state, action)` is the only way the game changes, and it is deterministic.
2. **The game page server** (`server/frontend.ts` → `dist/frontend.mjs`). It serves only the game page, with
   a strict Content-Security-Policy: only the page's own inline script and styles run, by hash.
   `MANA_BACKEND` sets the backend the page offers by default.

## Quick start

With Docker:

```bash
docker run -d --name mana-chess-frontend -p 8080:8080 \
  -e MANA_BACKEND=https://sakk-api.example.com \
  --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  ghcr.io/piguuccc-ops/mana-chess-frontend:latest
```

**For a complete server install** (backend + game page with one `docker compose up -d`), use the
[`docker-compose.yml`](https://github.com/piguuccc-ops/mana-chess-backend/blob/main/docker-compose.yml) in
the backend repository. Its [DEPLOY.md](https://github.com/piguuccc-ops/mana-chess-backend/blob/main/DEPLOY.md)
covers HTTPS with Nginx Proxy Manager, updates and backups.

Without Docker (Node.js 18 or newer):

```bash
npm install
npm run build          # dist/mana-chess.html + dist/frontend.mjs
npm start              # http://localhost:8080
```

| Command line | Environment | Default | Meaning |
|---|---|---|---|
| `--port 8081` | `PORT` | `8080` | Port to listen on |
| `--host 127.0.0.1` | `HOST` | all interfaces | Address to listen on |
| `--backend https://…` | `MANA_BACKEND` | – | The backend the game offers by default |
| `--game file.html` | | `mana-chess.html` next to `frontend.mjs` | Another build of the game |

The game finds its backend in this order:
1. the address the player signed in to last time;
2. the last address used;
3. `MANA_BACKEND`;
4. when the page came over plain http, port 8787 on the same host.

The player can always type another one.

## Development

```bash
npm install
npm run dev            # Vite dev server with hot reload: http://localhost:5173
npm test               # Vitest: chess rules (perft), mana, every spell, fuzzing, animations, online sync
npm run typecheck
npm run docs:spells    # regenerate SPELLS.md
npm run balance        # AI vs AI balance test → BALANCE.md (about 20 minutes)
```

**Changing the rules** (`src/engine/`, `src/net/protocol.ts`) changes the game's version. The backend
only lets in pages with its own version, so bring the change over there as well. In the backend
repository, run `npm run sync -- ../mana-chess-frontend`, then commit both repositories.

`tests/fixtures/lobby.ts` is a copy of the backend's rooms, used by the online-sync tests. The same
command refreshes it.

## Layout

```
src/
  engine/        the rules: board, moves, mana, the 71 spells, decks (pure TypeScript)
  ai/            a small alpha-beta AI with spell evaluation
  net/           online: protocol (shared with the backend) and the HTTP client
  ui/            screens, board, cards, the Online screen, pixel art, effects, sound
server/
  frontend.ts    the game page server
scripts/         single-file build, page-server build, version hash, spell docs, balance test
tests/           Vitest (fixtures/lobby.ts: copy of the backend's rooms)
docker/          the image's health check
release/         Start.bat / start.sh / README.txt for running without Docker
.github/         CI, image build (GHCR + optional Docker Hub), releases, Dependabot
```

## Images and releases

GitHub Actions builds `ghcr.io/piguuccc-ops/mana-chess-frontend` for `linux/amd64` and `linux/arm64`.
- **Tags:** `latest` on `main`, `1.2.3` / `1.2` for tags `v1.2.3`, and `sha-<commit>`.
- **Docker Hub:** also published there when the repository has the secrets `DOCKERHUB_USERNAME` and
  `DOCKERHUB_TOKEN`.
- **Weekly rebuild:** the image is rebuilt every week.
- **Release files:** a `v*` tag attaches `mana-chess.html` and a zip of the page server to a GitHub release.
