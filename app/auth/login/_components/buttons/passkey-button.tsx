"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";

/**
 * Sign-in button that triggers the WebAuthn passkey flow.
 * Calls `authClient.signIn.passkey` with `autoFill: false` so the browser
 * prompt is displayed on explicit interaction only. Redirects to `ROUTES.HOME`
 * on success and refreshes the active session.
 *
 * @author Maruf Bepary
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
      Use Passkey
    </BetterAuthActionButton>
  );
}
