"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";

/**
 * Offers a manual passkey button for sign-in.
 * @returns Passkey sign-in button component.
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
              router.push(ROUTES.HOME);
            },
          }
        )
      }
    >
      Use Passkey
    </BetterAuthActionButton>
  );
}
