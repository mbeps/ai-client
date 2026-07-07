import crypto from "crypto";
import { ALGORITHM, getSecret } from "./shared";

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
