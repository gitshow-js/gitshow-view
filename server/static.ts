/**
 * Static file server for the built SPA, with single-page-app fallback:
 * unknown non-API paths (the client-side routes /gh/..., /https/..., etc.)
 * are served index.html so the SPA router can handle them.
 */

import type { ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';
import type { Config } from './config.ts';
import { sendText } from './http.ts';

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
};

export async function serveStatic(res: ServerResponse, url: URL, cfg: Config): Promise<void> {
    const root = resolve(cfg.staticDir);

    let pathname: string;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return sendText(res, 400, 'Bad Request');
    }
    if (pathname.endsWith('/')) {
        pathname += 'index.html';
    }

    const candidate = normalize(join(root, pathname));
    // Path-traversal guard: the resolved path must stay within the static root.
    if (candidate !== root && !candidate.startsWith(root + sep)) {
        return sendText(res, 403, 'Forbidden');
    }

    if (await isFile(candidate)) {
        return stream(res, candidate, false);
    }
    // SPA fallback for client-side routes.
    return stream(res, join(root, 'index.html'), true);
}

async function isFile(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isFile();
    } catch {
        return false;
    }
}

function stream(res: ServerResponse, filePath: string, isFallback: boolean): void {
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    const headers: Record<string, string> = { 'Content-Type': type };
    // Vite emits content-hashed asset filenames; cache them aggressively.
    // index.html (and the SPA fallback) must always revalidate.
    if (!isFallback && filePath.includes(`${sep}assets${sep}`)) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (extname(filePath).toLowerCase() === '.html') {
        headers['Cache-Control'] = 'no-cache';
    }

    const fileStream = createReadStream(filePath);
    fileStream.on('error', () => {
        if (!res.headersSent) {
            sendText(res, 404, 'Not Found');
        } else {
            res.end();
        }
    });
    fileStream.once('open', () => {
        res.writeHead(200, headers);
        fileStream.pipe(res);
    });
}
