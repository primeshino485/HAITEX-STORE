import crypto from 'node:crypto';

// Secret key derivation
// The encryption key should be 32 bytes for AES-256-GCM.
// We derive a solid 32-byte key from process.env.DIGITAL_ACCOUNT_ENCRYPTION_KEY or a secure fallback.
const ENCRYPTION_SECRET = process.env.DIGITAL_ACCOUNT_ENCRYPTION_KEY || 'mystore_digital_account_secure_key_2026_salt_32bytes!';
const DERIVED_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'mystore-digital-account-salt-v1', 32);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES GCM

/**
 * Encrypt a plain-text password using AES-256-GCM.
 * Output format: "ivHex:tagHex:cipherHex"
 */
export function encryptAccountPassword(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted payload ("ivHex:tagHex:cipherHex").
 * Returns the decrypted plain-text password.
 */
export function decryptAccountPassword(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      // If it's not encrypted (e.g. legacy or unencrypted string), return as is
      return encryptedPayload;
    }
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('Erreur lors du déchiffrement du mot de passe:', err.message);
    return '••••••••••••';
  }
}

/**
 * Mask a password for safe public display
 */
export function maskPassword(length: number = 12): string {
  return '•'.repeat(Math.max(8, Math.min(length, 16)));
}
