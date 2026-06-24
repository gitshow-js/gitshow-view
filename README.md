# GitShow Viewer

This web application displays a [GitShow](https://github.com/gitshow-js/gitshow/) presentation from a public GitHub repository.

## Publishing your presentations

1. [Use GitShow](https://github.com/gitshow-js/gitshow#readme) to create a new markdown presentation.
2. Edit the markdown files to prepare the contents of your presentation.
3. Share the presentation sources in a public GitHub repository.
4. Go to [gitshow.net](https://gitshow.net/) and provide your GitHub repository (or a specific folder) URL.
5. You will get a direct link for showing the presentation online.

Alternatively, you may build and install your own instance of the viewer on your servers (see [Installation](https://github.com/gitshow-js/gitshow-view#installation) below).

## Demos

See [demo presentations](https://github.com/gitshow-js/demos) for a few examples of presentation sources.

## Installation

A running demo is available on [gitshow.net](https://gitshow.net/).

Building your own instance requires `node.js` (v20.6+ for the server; v24 recommended) and `npm` installed (e.g. from [NodeSource](https://github.com/nodesource/distributions)).

### Static-only (public repositories, no login)

```bash
npm run build
```

The static web files are built into the `dist` folder. Copy its contents to the root
of your web server. Anonymous viewing of public presentations works out of the box.
GitHub login (required for private repositories) needs the server below.

### Full instance with GitHub login (BFF server)

GitHub login is handled by a small bundled Node.js server (the *Backend-for-Frontend*).
It keeps the OAuth token server-side (encrypted in an HttpOnly cookie — never exposed to
the browser), performs the OAuth handshake, proxies authenticated GitHub calls, and
serves the built SPA. It replaces the old separate `gitshow-server` token proxy.

1. Register a [GitHub OAuth App](https://github.com/settings/developers). Set its
   **Authorization callback URL** to `<PUBLIC_BASE_URL>/auth/callback`
   (e.g. `https://gitshow.net/auth/callback`).
2. Configure secrets via environment variables — copy `.env.example` to `.env` and fill in
   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a `SESSION_KEY`
   (`openssl rand -base64 32`). Set `PUBLIC_BASE_URL` to your public origin.
   `.env` is gitignored; **no secrets live in the repository**.

**Run with Docker** (single container serving SPA + API on port `8084`):

```bash
docker compose up --build -d
```

**Run from source:**

```bash
npm run build            # build the SPA -> dist/
npm run build:server     # compile the server -> server/dist/
npm start                # node server/dist/index.js (reads env vars)
```

**Local development** (SPA hot-reload + server, proxied as same-origin):

```bash
npm run dev:server       # terminal 1 — BFF on :8084 (reads .env)
npm run dev              # terminal 2 — Vite dev server, proxies /auth and /api
```

#### Deployment notes

- The container listens on plain HTTP (`PORT`, default `8084`). Terminate TLS at your
  existing reverse proxy and forward to it; cookies are marked `Secure` automatically when
  `PUBLIC_BASE_URL` is `https://`.
- Configuration variables are documented in [`.env.example`](.env.example).

## Acknowledgements

Many thanks to [Reveal.js](https://revealjs.com/) authors and contributors for creating such an awesome presentation framework.
