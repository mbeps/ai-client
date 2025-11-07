"use client"

import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { authClient } from "@/lib/auth/auth-client"

/**
 * Button that triggers the password reset flow for users without a password.
 * @param email Address where the reset link should be delivered.
 * @returns Better Auth action button configured for password reset.
 */
export function SetPasswordButton({ email }: { email: string }) {
  return (
    <BetterAuthActionButton
      variant="outline"
      successMessage="Password reset email sent"
      action={() => {
        return authClient.requestPasswordReset({
          email,
          redirectTo: "/auth/reset-password",
        })
      }}
    >
      Send Password Reset Email
    </BetterAuthActionButton>
  )
}
