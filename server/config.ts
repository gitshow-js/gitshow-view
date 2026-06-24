/**
 * Runtime configuration for the GitShow View BFF server.
 *
 * All secrets and deployment-specific values come from environment variables.
 * Required variables are validated at startup so misconfiguration fails fast.
 */

export interface Config {
    /** GitHub OAuth App client id. */
    clientId: string;
    /** GitHub OAuth App client secret (kept server-side only). */
    clientSecret: string;
    /** OAuth scope requested from GitHub. */
    scope: string;
    /** 32-byte key for AES-256-GCM session/state cookie encryption. */
    sessionKey: Buffer;
    /** Public origin (e.g. https://gitshow.net); builds redirect_uri + Secure flag. */
    publicBaseUrl: string;
    /** Whether to mark cookies Secure (derived from publicBaseUrl scheme). */
    cookieSecure: boolean;
    /** TCP port the server listens on. */
    port: number;
    /** Directory holding the built SPA (index.html + assets). */
    staticDir: string;
}

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function loadConfig(): Config {
    const sessionKey = Buffer.from(required('SESSION_KEY'), 'base64');
    if (sessionKey.length !== 32) {
        throw new Error('SESSION_KEY must decode to 32 bytes (generate with: openssl rand -base64 32)');
    }

    const port = Number(process.env.PORT) || 8084;
    const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');

    return {
        clientId: required('GITHUB_CLIENT_ID'),
        clientSecret: required('GITHUB_CLIENT_SECRET'),
        scope: process.env.GITHUB_OAUTH_SCOPE || 'repo',
        sessionKey,
        publicBaseUrl,
        cookieSecure: publicBaseUrl.startsWith('https://'),
        port,
        staticDir: process.env.STATIC_DIR || './dist',
    };
}
