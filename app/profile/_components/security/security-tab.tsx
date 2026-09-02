import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";
import { ChangePasswordForm } from "./change-password-form";
import { PasskeyManagement } from "./passkey-management";
import { SetPasswordButton } from "./set-password-button";
import { TwoFactorAuth } from "./two-factor-auth";

/**
 * Server component aggregating password, two-factor authentication, and passkey management.
 * Conditionally displays password change or setup based on account type and feature flags.
 * Includes 2FA toggle and WebAuthn passkey management.
 *
 * @author Maruf Bepary
 */
export async function SecurityTab({
  email,
  isTwoFactorEnabled,
}: {
  email: string;
  isTwoFactorEnabled: boolean;
}) {
  const [passkeys, accounts] = await Promise.all([
    auth.api.listPasskeys({ headers: await headers() }),
    auth.api.listUserAccounts({ headers: await headers() }),
  ]);

  const hasPasswordAccount = accounts.some(
    (a) => a.providerId === "credential",
  );

  return (
    <div className="space-y-8">
      {env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD &&
        (hasPasswordAccount ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">Change Password</h3>
              <p className="text-muted-foreground text-sm">
                Update your password for improved security.
              </p>
            </div>
            <ChangePasswordForm />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">Set Password</h3>
              <p className="text-muted-foreground text-sm">
                We will send you a password reset email to set up a password.
              </p>
            </div>
            <SetPasswordButton email={email} />
          </div>
        ))}

      {hasPasswordAccount && env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-lg">Two-Factor Authentication</h3>
              <Badge variant={isTwoFactorEnabled ? "default" : "secondary"}>
                {isTwoFactorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <TwoFactorAuth isEnabled={isTwoFactorEnabled} />
          </div>
        </>
      )}

      <Separator />
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-lg">Passkeys</h3>
        </div>
        <PasskeyManagement passkeys={passkeys} />
      </div>
    </div>
  );
}
