/**
 * GitShow View BFF server.
 *
 * Serves the built SPA and provides the server-side OAuth handshake (/auth/*)
 * and the authenticated GitHub API proxy (/api/gh/*). Same-origin with the SPA,
 * so the session cookie is first-party and no CORS is required.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from './config.ts';
import { handleAuth } from './auth.ts';
import { handleProxy } from './proxy.ts';
import { serveStatic } from './static.ts';
import { sendJson } from './http.ts';

const cfg = loadConfig();

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
        const url = new URL(req.url || '/', cfg.publicBaseUrl);
        const path = url.pathname;

        if (path === '/auth' || path.startsWith('/auth/')) {
            await handleAuth(req, res, url, cfg);
        } else if (path === '/api/gh' || path.startsWith('/api/gh/')) {
            await handleProxy(req, res, url, cfg);
        } else if (path.startsWith('/api/')) {
            sendJson(res, 404, { error: 'not_found' });
        } else {
            await serveStatic(res, url, cfg);
        }
    } catch (err) {
        console.error('Request error:', err);
        if (!res.headersSent) {
            sendJson(res, 500, { error: 'internal_server_error' });
        } else {
            res.end();
        }
    }
});

server.listen(cfg.port, () => {
    console.log(`gitshow-view server listening on port ${cfg.port}`);
});
