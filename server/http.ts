/**
 * Small dependency-free helpers around node:http for cookies, JSON/text
 * responses, and request body buffering.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export function parseCookies(req: IncomingMessage): Record<string, string> {
    const out: Record<string, string> = {};
    const header = req.headers.cookie;
    if (!header) {
        return out;
    }
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const name = part.slice(0, idx).trim();
        if (name) {
            out[name] = decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return out;
}

export interface CookieOptions {
    maxAge?: number; // seconds
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
    let cookie = `${name}=${encodeURIComponent(value)}`;
    cookie += `; Path=${opts.path ?? '/'}`;
    if (opts.maxAge !== undefined) {
        cookie += `; Max-Age=${opts.maxAge}`;
    }
    if (opts.httpOnly) {
        cookie += '; HttpOnly';
    }
    if (opts.secure) {
        cookie += '; Secure';
    }
    if (opts.sameSite) {
        cookie += `; SameSite=${opts.sameSite}`;
    }
    return cookie;
}

/** Appends a Set-Cookie header without clobbering ones already set. */
export function appendCookie(res: ServerResponse, cookie: string): void {
    const prev = res.getHeader('Set-Cookie');
    if (prev === undefined) {
        res.setHeader('Set-Cookie', cookie);
    } else if (Array.isArray(prev)) {
        res.setHeader('Set-Cookie', [...prev, cookie]);
    } else {
        res.setHeader('Set-Cookie', [String(prev), cookie]);
    }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}

export function sendText(res: ServerResponse, status: number, body: string): void {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
}

export function redirect(res: ServerResponse, location: string): void {
    res.writeHead(302, { Location: location });
    res.end();
}

const BODY_LIMIT = 25 * 1024 * 1024; // 25 MB — accommodates base64 blobs for commits

export function readRequestBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > BODY_LIMIT) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
