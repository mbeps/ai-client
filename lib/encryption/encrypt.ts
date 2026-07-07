import crypto from "crypto";
import { ALGORITHM, getSecret } from "./shared";

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
