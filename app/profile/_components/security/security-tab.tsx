import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { SetPasswordButton } from "./set-password-button";
import { ChangePasswordForm } from "./change-password-form";
import { TwoFactorAuth } from "./two-factor-auth";
import { PasskeyManagement } from "./passkey-management";
import { passkey } from "@better-auth/passkey";

type Account = Awaited<ReturnType<typeof auth.api.listUserAccounts>>[number];

/**
 * Server component that aggregates password, 2FA, and passkey management data.
 * @param email Email address used for password setup flows.
 * @param isTwoFactorEnabled Current two-factor state for the user.
 * @returns Stacked security cards for password, 2FA, and passkeys.
 */
export async function SecurityTab({
  email,
  isTwoFactorEnabled,
}: {
  email: string;
  isTwoFactorEnabled: boolean;
}) {
  const passkeyApi = auth.api as typeof auth.api &
    ReturnType<typeof passkey>["endpoints"];
  const [passkeys, accounts] = await Promise.all([
    passkeyApi.listPasskeys({ headers: await headers() }),
    auth.api.listUserAccounts({ headers: await headers() }),
  ]);

  const hasPasswordAccount = accounts.some(
    (account: Account) => account.providerId === "credential",
  );

  return (
    <div className="space-y-6">
      {hasPasswordAccount ? (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password for improved security.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Set Password</CardTitle>
            <CardDescription>
              We will send you a password reset email to set up a password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SetPasswordButton email={email} />
          </CardContent>
        </Card>
      )}
      {hasPasswordAccount && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Two-Factor Authentication</CardTitle>
            <Badge variant={isTwoFactorEnabled ? "default" : "secondary"}>
              {isTwoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardHeader>
          <CardContent>
            <TwoFactorAuth isEnabled={isTwoFactorEnabled} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
        </CardHeader>
        <CardContent>
          <PasskeyManagement passkeys={passkeys} />
        </CardContent>
      </Card>
    </div>
  );
}
