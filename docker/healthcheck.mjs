// Docker HEALTHCHECK for the game page server: healthy when it serves the page.
// (The image has no shell or curl – Node itself does the check.)
const port = process.env.PORT || 4545;
try {
  const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
