import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { TotpForm } from "./_components/totp-form";
import { BackupCodeTab } from "./_components/backup-code-tab";
import { LifeBuoy, Smartphone } from "lucide-react";

const TAB_VALUES = {
  TOTP: "totp",
  BACKUP: "backup",
} as const;

/**
 * Two-factor authentication challenge page for users with 2FA enabled.
 * Route: /auth/2fa. Server-rendered; redirects fully authenticated users to home.
 * Requires intermediate auth session with pending 2FA verification.
 *
 * @returns Challenge page with TOTP authenticator and backup code tabs.
 * @see LoginPage for initial email/password authentication flow.
 * @author Maruf Bepary
 */
export default async function TwoFactorPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // Redirect signed-in users away from the 2FA challenge screen.
  if (session != null) return redirect(ROUTES.HOME.path);

  return (
    <div className="my-6 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={TAB_VALUES.TOTP}>
            <TabsList className="grid w-full grid-cols-2 mb-8">
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
