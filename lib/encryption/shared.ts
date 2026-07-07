import crypto from "crypto";
import { env } from "@/lib/env";

export const ALGORITHM = "aes-256-gcm";

/**
 * Validates and retrieves the encryption secret from environment variables.
 * Derives a 32-byte key using SHA-256 to allow variable-length secrets in .env.
 */
export function getSecret() {
  return crypto.createHash("sha256").update(env.ENCRYPTION_SECRET).digest();
}
