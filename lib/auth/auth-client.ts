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
 * Use for all client-side auth operations (sign-in, sign-up, session hooks, etc.).
 * The twoFactorClient plugin automatically redirects to /auth/2fa when a 2FA challenge is required.
 *
 * @see https://better-auth.com/docs/client/react
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
