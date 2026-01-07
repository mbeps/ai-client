"use client"

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button"
import { authClient } from "@/lib/auth/auth-client"

/**
 * Danger zone button that starts the Better Auth account deletion flow.
 * @returns Action button that emails a confirmation link.
 */
export function AccountDeletion() {
  return (
    <BetterAuthActionButton
      requireAreYouSure
      variant="destructive"
      className="w-full"
      successMessage="Account deletion initiated. Please check your email to confirm."
      action={() => authClient.deleteUser({ callbackURL: "/" })}
    >
      Delete Account Permanently
    </BetterAuthActionButton>
  )
}
