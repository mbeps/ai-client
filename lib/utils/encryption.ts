import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Robust encryption utility for securing sensitive user credentials in the database.
 * Uses AES-256-GCM for authenticated encryption, ensuring both confidentiality and integrity.
 *
 * Format: iv:authTag:content (hex encoded)
 * Requires ENCRYPTION_SECRET (32 characters) to be set in environment variables.
 *
 * @author Maruf Bepary
 */

const ALGORITHM = "aes-256-gcm";

/**
 * Validates and retrieves the encryption secret from environment variables.
 * Derives a 32-byte key using SHA-256 to allow variable-length secrets in .env.
 */
function getSecret() {
  return crypto.createHash("sha256").update(env.ENCRYPTION_SECRET).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param text The raw string to encrypt.
 * @returns A composite hex string in the format `iv:authTag:content`.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // GCM standard IV length
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a hex-encoded hash back into plaintext.
 * @param hash The composite hex string in the format `iv:authTag:content`.
 * @returns The original plaintext string.
 * @throws Error if the hash format is invalid or decryption fails (tampering/wrong secret).
 */
export function decrypt(hash: string): string {
  const [ivHex, authTagHex, encryptedText] = hash.split(":");

  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error(
      "Invalid encrypted text format. Expected iv:authTag:content",
    );
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
