import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

const authHandlers = toNextJsHandler(auth);

/**
 * Better Auth catch-all route handler for all `/api/auth/*` paths.
 * Delegates authentication logic (sign-in, sign-up, OAuth callbacks, email verification,
 * password reset, session management, MFA) to the Better Auth framework.
 *
 * **HTTP Methods:** GET, POST
 *
 * **Request Format:** JSON body for POST (credentials, tokens, or provider data)
 *
 * **Response Format:** JSON (session object, error object, or provider callback)
 *
 * **Authentication:** Session-based or provider token-based
 *
 * **Supported Endpoints:**
 * - POST `/api/auth/sign-up` — Email/password registration
 * - POST `/api/auth/sign-in` — Email/password login
 * - GET `/api/auth/oauth/[provider]/callback` — OAuth provider callbacks
 * - POST `/api/auth/verify-email` — Email verification confirmation
 * - POST `/api/auth/forgot-password` — Password reset request
 * - POST `/api/auth/reset-password` — Password reset confirmation
 * - POST `/api/auth/sign-out` — Session termination
 * - GET `/api/auth/session` — Active session check
 * - POST `/api/auth/passkey/*` — WebAuthn credential registration/auth
 * - POST `/api/auth/2fa/*` — TOTP setup, verification, backup codes
 *
 * @author Maruf Bepary
 * @see {@link lib/auth/auth} for Better Auth configuration and providers
 */
export const { GET, POST } = authHandlers;
