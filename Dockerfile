# ─────────────────────────────────────────────────────────────────────────────
# Mana Chess game page – serves the single-file game (mana-chess.html) and nothing else, with a
# strict Content-Security-Policy. MANA_BACKEND sets the backend the page offers by default.
#
# Two stages: the game and the page server are built with the build tools, then only the two
# files go into a distroless Node.js image – no shell, no package manager – running as an
# unprivileged user (uid 65532). It writes nothing, so it runs with a read-only filesystem.
#
#   docker build -t mana-chess-frontend .
#   docker run -d -p 8080:8080 -e MANA_BACKEND=https://sakk-api.example.com --read-only --cap-drop ALL mana-chess-frontend
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. build (runs on the build machine's own platform; the output is plain JavaScript/HTML) ──
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN node scripts/build-single.mjs && node scripts/build-server.mjs

# ── 2. run ──
FROM gcr.io/distroless/nodejs22-debian12:nonroot
LABEL org.opencontainers.image.title="Mana Chess game page" \
      org.opencontainers.image.description="Serves the Mana Chess game (one self-contained HTML page)"
WORKDIR /app
COPY --from=build /src/dist/frontend.mjs /src/dist/mana-chess.html /src/dist/healthcheck.mjs /app/
ENV NODE_ENV=production \
    PORT=8080
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/nodejs/bin/node", "/app/healthcheck.mjs"]
ENTRYPOINT ["/nodejs/bin/node", "/app/frontend.mjs", "--no-open"]
