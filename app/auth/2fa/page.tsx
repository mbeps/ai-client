import { LifeBuoy, Smartphone } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth/auth";
import { BackupCodeTab } from "./_components/backup-code-tab";
import { TotpForm } from "./_components/totp-form";

const TAB_VALUES = {
  TOTP: "totp",
  BACKUP: "backup",
} as const;

/**
 * Two-factor authentication (2FA) challenge page that completes the login flow for users with 2FA enabled.
 * Server-rendered page that validates user has an intermediate auth session pending 2FA verification.
 * Displays TOTP authenticator code entry and backup code verification as alternative fallback methods.
 * Security: Redirects pre-authenticated users away from this page; requires pending 2FA challenge state.
 *
 * @author Maruf Bepary
 * @see TwoFactorPage for initial email/password authentication flow
 */
export default async function TwoFactorPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // Redirect signed-in users away from the 2FA challenge screen.
  if (session != null) return redirect(ROUTES.HOME.path);

  return (
    <div className="my-6 px-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-bold text-2xl">
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={TAB_VALUES.TOTP}>
            <TabsList className="mb-8 grid w-full grid-cols-2">
              <TabsTrigger
                value={TAB_VALUES.TOTP}
                className="flex items-center"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Authenticator
              </TabsTrigger>
              <TabsTrigger
                value={TAB_VALUES.BACKUP}
                className="flex items-center"
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                Backup Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value={TAB_VALUES.TOTP}>
              <TotpForm />
            </TabsContent>

            <TabsContent value={TAB_VALUES.BACKUP}>
              <BackupCodeTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
