/**
 * Authenticated encryption for cookie payloads (the OAuth token and OAuth state).
 *
 * Uses AES-256-GCM. The serialized form is base64url(iv | authTag | ciphertext),
 * so the token stored in the browser's cookie is opaque and tamper-evident — it
 * never reaches client-side JavaScript in plaintext.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

export function encrypt(plaintext: string, key: Buffer): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

/** Decrypts a payload produced by encrypt(). Returns null on any failure. */
export function decrypt(payload: string, key: Buffer): string | null {
    try {
        const buf = Buffer.from(payload, 'base64url');
        if (buf.length <= IV_LEN + TAG_LEN) {
            return null;
        }
        const iv = buf.subarray(0, IV_LEN);
        const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
        const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}
