# Security

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's **Report a vulnerability** button:
Security tab → Advisories. You can also contact the maintainer privately.

## What is in place

- **The page server** hands out only the game page.
  - It sends a strict Content-Security-Policy: only the page's own inline script and style block run,
    matched by hash. Images and fonts can only be `data:` URLs.
  - It also blocks frames from other sites, forms, plugins and `<base>`.
  - It adds `nosniff`, `no-referrer` and a restrictive Permissions-Policy.
- **The game** never inserts server-provided text as HTML. The backend address it is given is sanitised
  before it goes into the page.
- **Container.**
  - A distroless image with no shell and no package manager.
  - Runs as a non-root user (uid 65532).
  - Runs with a read-only root filesystem and all Linux capabilities dropped, and never writes anything.
- **Supply chain.**
  - Dependabot watches npm packages, the base images and GitHub Actions.
  - Images are rebuilt weekly and published with SBOM and provenance attestations.
