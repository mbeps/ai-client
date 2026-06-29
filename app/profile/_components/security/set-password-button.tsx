"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/constants/routes";
import { Mail } from "lucide-react";

/**
 * Action button that initiates password setup via email reset link for users without existing password.
 * Typically used for OAuth-only accounts that need to add password authentication.
 *
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
