"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { UserX } from "lucide-react";

/**
 * Danger zone button that starts the Better Auth account deletion flow.
 * @returns Action button that emails a confirmation link.
 * @author Maruf Bepary
 */
export function AccountDeletion() {
  return (
    <BetterAuthActionButton
      requireAreYouSure
      variant="destructive"
      className="w-full"
      successMessage="Account deletion initiated. Please check your email to confirm."
      action={() => authClient.deleteUser({ callbackURL: ROUTES.HOME.path })}
    >
      <UserX className="mr-2 h-4 w-4" />
      Delete Account Permanently
    </BetterAuthActionButton>
  );
}
