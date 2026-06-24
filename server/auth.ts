/**
 * Server-side GitHub OAuth handshake (the BFF half of the auth flow).
 *
 *   GET  /auth/login?return=<path>  -> redirect to GitHub with CSRF state
 *   GET  /auth/callback?code&state  -> exchange code, set encrypted session cookie
 *   POST /auth/logout               -> clear the session cookie
 *   GET  /auth/me                   -> return the logged-in GitHub user (or 401)
 *
 * The OAuth access token is stored only inside an encrypted, HttpOnly cookie and
 * is never exposed to browser JavaScript.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Config } from './config.ts';
import { encrypt, decrypt } from './crypto.ts';
import {
    parseCookies, serializeCookie, appendCookie, sendJson, redirect,
} from './http.ts';

const SESSION_COOKIE = 'gs_session';
const STATE_COOKIE = 'gs_oauth';
const SESSION_MAX_AGE = 7 * 24 * 3600; // 7 days
const STATE_MAX_AGE = 600;             // 10 minutes
const STATE_PATH = '/auth';

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

interface StatePayload {
    state: string;
    returnPath: string;
}

/** Reads and decrypts the OAuth token from the session cookie, or null. */
export function getSessionToken(req: IncomingMessage, cfg: Config): string | null {
    const raw = parseCookies(req)[SESSION_COOKIE];
    return raw ? decrypt(raw, cfg.sessionKey) : null;
}

function setSessionCookie(res: ServerResponse, value: string, cfg: Config, maxAge: number): void {
    appendCookie(res, serializeCookie(SESSION_COOKIE, value, {
        httpOnly: true, secure: cfg.cookieSecure, sameSite: 'Lax', path: '/', maxAge,
    }));
}

function clearSessionCookie(res: ServerResponse, cfg: Config): void {
    setSessionCookie(res, '', cfg, 0);
}

/** Only allow same-site, non-protocol-relative return paths (open-redirect guard). */
function safeReturnPath(p: string | null): string {
    return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

export async function handleAuth(
    req: IncomingMessage, res: ServerResponse, url: URL, cfg: Config,
): Promise<void> {
    switch (url.pathname) {
        case '/auth/login': return login(res, url, cfg);
        case '/auth/callback': return callback(req, res, url, cfg);
        case '/auth/logout': return logout(res, cfg);
        case '/auth/me': return me(req, res, cfg);
        default: return sendJson(res, 404, { error: 'not_found' });
    }
}

function login(res: ServerResponse, url: URL, cfg: Config): void {
    const returnPath = safeReturnPath(url.searchParams.get('return'));
    const state = randomBytes(16).toString('hex');

    const payload: StatePayload = { state, returnPath };
    appendCookie(res, serializeCookie(STATE_COOKIE, encrypt(JSON.stringify(payload), cfg.sessionKey), {
        httpOnly: true, secure: cfg.cookieSecure, sameSite: 'Lax', path: STATE_PATH, maxAge: STATE_MAX_AGE,
    }));

    const authUrl = new URL(GITHUB_AUTHORIZE);
    authUrl.searchParams.set('client_id', cfg.clientId);
    authUrl.searchParams.set('scope', cfg.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', `${cfg.publicBaseUrl}/auth/callback`);
    redirect(res, authUrl.toString());
}

async function callback(
    req: IncomingMessage, res: ServerResponse, url: URL, cfg: Config,
): Promise<void> {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const stateRaw = parseCookies(req)[STATE_COOKIE];

    // The short-lived state cookie is single-use; clear it regardless of outcome.
    appendCookie(res, serializeCookie(STATE_COOKIE, '', {
        httpOnly: true, secure: cfg.cookieSecure, sameSite: 'Lax', path: STATE_PATH, maxAge: 0,
    }));

    const decoded = stateRaw ? decrypt(stateRaw, cfg.sessionKey) : null;
    let payload: StatePayload | null = null;
    if (decoded) {
        try {
            payload = JSON.parse(decoded) as StatePayload;
        } catch {
            payload = null;
        }
    }

    const returnPath = safeReturnPath(payload?.returnPath ?? null);

    // CSRF: the state from GitHub must match the one we stored in the cookie.
    if (!code || !state || !payload || payload.state !== state) {
        return redirect(res, returnPath);
    }

    const token = await exchangeCode(code, cfg);
    if (!token) {
        return redirect(res, returnPath);
    }

    setSessionCookie(res, encrypt(token, cfg.sessionKey), cfg, SESSION_MAX_AGE);
    redirect(res, returnPath);
}

async function exchangeCode(code: string, cfg: Config): Promise<string | null> {
    const response = await fetch(GITHUB_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code }),
    });
    if (!response.ok) {
        return null;
    }
    const data = await response.json() as { access_token?: string };
    return data.access_token ?? null;
}

function logout(res: ServerResponse, cfg: Config): void {
    clearSessionCookie(res, cfg);
    res.writeHead(204);
    res.end();
}

async function me(req: IncomingMessage, res: ServerResponse, cfg: Config): Promise<void> {
    const token = getSessionToken(req, cfg);
    if (!token) {
        return sendJson(res, 401, { error: 'not_authenticated' });
    }
    const response = await fetch(`${GITHUB_API}/user`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'gitshow-view',
        },
    });
    if (!response.ok) {
        // Token revoked/expired — drop the stale session.
        clearSessionCookie(res, cfg);
        return sendJson(res, 401, { error: 'not_authenticated' });
    }
    const user = await response.json() as { login: string; name?: string; avatar_url?: string };
    sendJson(res, 200, { login: user.login, name: user.name, avatar_url: user.avatar_url });
}
