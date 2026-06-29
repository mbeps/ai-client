"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/constants/routes";
import {
  SUPPORTED_OAUTH_PROVIDER_DETAILS,
  SUPPORTED_OAUTH_PROVIDERS,
} from "@/lib/auth/o-auth-providers";

/**
 * Renders OAuth sign-in buttons for all configured social providers (GitHub, Discord, etc.).
 * Maps over `SUPPORTED_OAUTH_PROVIDERS` to dynamically render buttons with provider branding.
 * Each button triggers OAuth flow with home page as the callback destination.
 *
 * @author Maruf Bepary
 * @see PasskeyButton for passwordless sign-in option
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
