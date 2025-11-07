import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { TotpForm } from "./_components/totp-form"
import { BackupCodeTab } from "./_components/backup-code-tab"

/**
 * Interstitial page that verifies users during two-factor authentication challenges.
 * @returns Two-factor challenge page with TOTP and backup code tabs.
 */
export default async function TwoFactorPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  // Redirect signed-in users away from the 2FA challenge screen.
  if (session != null) return redirect("/")

  return (
    <div className="my-6 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="totp">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="totp">Authenticator</TabsTrigger>
              <TabsTrigger value="backup">Backup Code</TabsTrigger>
            </TabsList>

            <TabsContent value="totp">
              <TotpForm />
            </TabsContent>

            <TabsContent value="backup">
              <BackupCodeTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
