import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";
import {
  inferAdditionalFields,
  twoFactorClient,
  adminClient,
  organizationClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { ac, admin, user } from "@/components/auth/utils/permissions";
import { ROUTES } from "../routes";
import { GLOBAL_ROLES } from "./roles";

/**
 * Better Auth React client with passkey, two-factor, admin, and organization plugins.
 * @see https://docs.better-auth.com/client/react
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = ROUTES.AUTH.TWO_FACTOR;
      },
    }),
    adminClient({
      ac,
      roles: {
        [GLOBAL_ROLES.ADMIN]: admin,
        [GLOBAL_ROLES.USER]: user,
      },
    }),
    organizationClient(),
  ],
});
