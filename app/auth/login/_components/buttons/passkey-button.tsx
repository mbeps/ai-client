"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Attempts automatic passkey sign-in and offers a manual passkey button.
 * @returns Passkey sign-in button component.
 */
export function PasskeyButton() {
  const router = useRouter();
  const { refetch } = authClient.useSession();

  // Attempt a silent passkey sign-in when the component mounts.
  useEffect(() => {
    authClient.signIn.passkey(
      { autoFill: true },
      {
        onSuccess() {
          refetch();
          router.push(ROUTES.HOME);
        },
      }
    );
  }, [router, refetch]);

  return (
    <BetterAuthActionButton
      variant="outline"
      className="w-full"
      action={() =>
        authClient.signIn.passkey(undefined, {
          onSuccess() {
            refetch();
            router.push(ROUTES.HOME);
          },
        })
      }
    >
      Use Passkey
    </BetterAuthActionButton>
  );
}
