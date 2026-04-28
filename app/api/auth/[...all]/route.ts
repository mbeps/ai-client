import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

const authHandlers = toNextJsHandler(auth);

/**
 * Better Auth catch-all API route handler for all /api/auth/* paths.
 * Handles sign-in, sign-up, OAuth callbacks (GitHub, Discord), email verification, password reset, session management, and MFA flows.
 * Delegates all authentication logic to the Better Auth `auth` instance configured in `lib/auth/auth`.
 *
 * SUPPORTED ENDPOINTS:
 * - POST /api/auth/sign-up (email/password registration)
 * - POST /api/auth/sign-in (email/password login)
 * - GET /api/auth/oauth/[provider]/callback (OAuth provider callbacks)
 * - POST /api/auth/verify-email (email verification confirmation)
 * - POST /api/auth/forgot-password (password reset request)
 * - POST /api/auth/reset-password (password reset confirmation)
 * - POST /api/auth/sign-out (session termination)
 * - GET /api/auth/session (active session check)
 * - POST /api/auth/passkey/* (WebAuthn credential registration/auth)
 * - POST /api/auth/2fa/* (TOTP setup, verification, and backup codes)
 *
 * @see auth configuration in lib/auth/auth for providers and hooks
 * @author Maruf Bepary
 */
export const { GET, POST } = authHandlers;
