import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";
import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { ROUTES } from "../routes";

/**
 * Better Auth React client configured with passkey, two-factor, and field-inference plugins.
 * Use for all client-side auth operations: `useSession()`, `signIn()`, `signUp()`, `signOut()`, etc.
 * The twoFactorClient plugin automatically redirects to /auth/2fa on 2FA challenge; passkeyClient handles WebAuthn flow.
 * Sessions are managed via HTTP-only cookies and cannot be accessed directly from JavaScript (XSS protection).
 *
 * @see {@link https://better-auth.com/docs/client/react} for full API reference
 * @see {@link lib/auth/auth.ts} for server-side configuration
 * @author Maruf Bepary
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = ROUTES.AUTH.TWO_FACTOR.path;
      },
    }),
  ],
});
