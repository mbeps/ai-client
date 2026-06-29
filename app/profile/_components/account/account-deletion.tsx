"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/constants/routes";
import { UserX } from "lucide-react";

/**
 * Displays a destructive action button that initiates the Better Auth account deletion flow.
 * Sends a confirmation email to prevent accidental deletion. This is a sensitive operation
 * that permanently removes the account and all associated data upon confirmation.
 *
 * @returns Destructive action button with "Are you sure?" confirmation.
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
