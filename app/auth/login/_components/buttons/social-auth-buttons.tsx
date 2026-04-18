"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import {
  SUPPORTED_OAUTH_PROVIDER_DETAILS,
  SUPPORTED_OAUTH_PROVIDERS,
} from "@/lib/auth/o-auth-providers";

/**
 * Renders a `BetterAuthActionButton` for every configured OAuth provider.
 * Iterates `SUPPORTED_OAUTH_PROVIDERS`, rendering each provider's icon and name.
 * Redirects to `ROUTES.HOME` on a successful OAuth callback.
 *
 * @author Maruf Bepary
 */
export function SocialAuthButtons() {
  return SUPPORTED_OAUTH_PROVIDERS.map((provider) => {
    const Icon = SUPPORTED_OAUTH_PROVIDER_DETAILS[provider].Icon;

    return (
      <BetterAuthActionButton
        variant="outline"
        key={provider}
        action={() => {
          return authClient.signIn.social({
            provider,
            callbackURL: ROUTES.HOME.path,
          });
        }}
      >
        <Icon />
        {SUPPORTED_OAUTH_PROVIDER_DETAILS[provider].name}
      </BetterAuthActionButton>
    );
  });
}
