import crypto from 'crypto';

// The key should be 32 bytes for AES-256
// In a real application, this should be stored securely in an environment variable.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 characters
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a text string using AES-256-CBC
 */
export function encryptData(text: string): string {
    if (!text) return text;

    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts an AES-256-CBC encrypted string
 */
export function decryptData(text: string): string | null {
    if (!text) return null;

    try {
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift() as string, 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');

        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Deterministically hashes a string (like a phone number) for searching
 * Uses SHA-256 so the same phone number always produces the same hash.
 */
export function hashSearchableData(text: string): string {
    if (!text) return text;
    return crypto.createHash('sha256').update(text).digest('hex');
}
