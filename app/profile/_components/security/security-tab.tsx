import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { SetPasswordButton } from "./set-password-button";
import { ChangePasswordForm } from "./change-password-form";
import { TwoFactorAuth } from "./two-factor-auth";
import { PasskeyManagement } from "./passkey-management";

/**
 * Server component that aggregates password, 2FA, and passkey management data.
 * @param email Email address used for password setup flows.
 * @param isTwoFactorEnabled Current two-factor state for the user.
 * @returns Stacked security settings for password, 2FA, and passkeys.
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
      {hasPasswordAccount ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Change Password</h3>
            <p className="text-sm text-muted-foreground">
              Update your password for improved security.
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Set Password</h3>
            <p className="text-sm text-muted-foreground">
              We will send you a password reset email to set up a password.
            </p>
          </div>
          <SetPasswordButton email={email} />
        </div>
      )}

      {hasPasswordAccount && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
            <Badge variant={isTwoFactorEnabled ? "default" : "secondary"}>
              {isTwoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <TwoFactorAuth isEnabled={isTwoFactorEnabled} />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Passkeys</h3>
        </div>
        <PasskeyManagement passkeys={passkeys} />
      </div>
    </div>
  );
}
