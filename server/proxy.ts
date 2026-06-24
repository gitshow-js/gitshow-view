/**
 * Authenticated GitHub API proxy: /api/gh/* -> https://api.github.com/*
 *
 * Requires a valid session cookie, injects the OAuth token server-side, and
 * forwards only to the fixed api.github.com host (no user-controlled host, so
 * no SSRF / open proxy). GitHub's status and body are relayed verbatim.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { getSessionToken } from './auth.ts';
import { readRequestBody, sendJson } from './http.ts';

const GITHUB_API = 'https://api.github.com';
const PREFIX = '/api/gh';

export async function handleProxy(
    req: IncomingMessage, res: ServerResponse, url: URL, cfg: Config,
): Promise<void> {
    const token = getSessionToken(req, cfg);
    if (!token) {
        return sendJson(res, 401, { error: 'not_authenticated' });
    }

    // url.pathname is already normalized by the URL parser (no '..'), so the
    // target host can only ever be api.github.com.
    const rest = url.pathname.slice(PREFIX.length);
    const target = GITHUB_API + rest + url.search;

    const method = req.method || 'GET';
    const headers: Record<string, string> = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gitshow-view',
    };

    let body: Buffer | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
        body = await readRequestBody(req);
        const contentType = req.headers['content-type'];
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
    }

    const ghResponse = await fetch(target, { method, headers, body });
    const buffer = Buffer.from(await ghResponse.arrayBuffer());

    const responseHeaders: Record<string, string> = {};
    const contentType = ghResponse.headers.get('content-type');
    if (contentType) {
        responseHeaders['Content-Type'] = contentType;
    }
    res.writeHead(ghResponse.status, responseHeaders);
    res.end(buffer);
}
