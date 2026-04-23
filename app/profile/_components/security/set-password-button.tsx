"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { Mail } from "lucide-react";

/**
 * Button that triggers the password reset flow for users without a password.
 * @param email Address where the reset link should be delivered.
 * @returns Better Auth action button configured for password reset.
 * @author Maruf Bepary
 */
export function SetPasswordButton({ email }: { email: string }) {
  return (
    <BetterAuthActionButton
      variant="outline"
      successMessage="Password reset email sent"
      action={() => {
        return authClient.requestPasswordReset({
          email,
          redirectTo: ROUTES.AUTH.RESET_PASSWORD.path,
        });
      }}
    >
      <Mail className="mr-2 h-4 w-4" />
      Send Password Reset Email
    </BetterAuthActionButton>
  );
}
