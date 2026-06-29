"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/constants/routes";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";

/**
 * Sign-in button that initiates passwordless WebAuthn passkey authentication.
 * Provides a secure, phishing-resistant authentication method using platform-specific credentials.
 * Sets `autoFill: false` to display the browser WebAuthn dialog only on explicit button interaction.
 * Refetches the session and redirects to home on successful authentication.
 *
 * @author Maruf Bepary
 * @see SocialAuthButtons for OAuth-based sign-in alternatives
 */
export function PasskeyButton() {
  const router = useRouter();
  const { refetch } = authClient.useSession();

  return (
    <BetterAuthActionButton
      variant="outline"
      className="w-full"
      action={() =>
        authClient.signIn.passkey(
          { autoFill: false },
          {
            onSuccess() {
              refetch();
              router.push(ROUTES.HOME.path);
            },
          },
        )
      }
    >
      <Fingerprint className="mr-2 h-4 w-4" />
      Use Passkey
    </BetterAuthActionButton>
  );
}
