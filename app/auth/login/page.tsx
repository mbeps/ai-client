"use client"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SignUpTab } from "./_components/sign-up-tab"
import { SignInTab } from "./_components/sign-in-tab"
import { Separator } from "@/components/ui/separator"
import { SocialAuthButtons } from "./_components/social-auth-buttons"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth/auth-client"
import { useRouter } from "next/navigation"
import { EmailVerification } from "./_components/email-verification"
import { ForgotPassword } from "./_components/forgot-password"

type Tab = "signin" | "signup" | "email-verification" | "forgot-password"

/**
 * Auth entry point that combines sign-in, sign-up, verification, and reset flows.
 * @returns Client-rendered login page with tabbed navigation.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [selectedTab, setSelectedTab] = useState<Tab>("signin")

  // Redirect authenticated users away from the auth flow.
  useEffect(() => {
    authClient.getSession().then(session => {
      if (session.data != null) router.push("/")
    })
  }, [router])

  /**
   * Switches to the email verification tab and stores the target email.
   * @param email Address that needs verification.
   */
  function openEmailVerificationTab(email: string) {
    setEmail(email)
    setSelectedTab("email-verification")
  }

  return (
    <Tabs
      value={selectedTab}
      onValueChange={t => setSelectedTab(t as Tab)}
      className="max-auto w-full my-6 px-4"
    >
      {(selectedTab === "signin" || selectedTab === "signup") && (
        <TabsList>
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="signin">
        <Card>
          <CardHeader className="text-2xl font-bold">
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInTab
              openEmailVerificationTab={openEmailVerificationTab}
              openForgotPassword={() => setSelectedTab("forgot-password")}
            />
          </CardContent>

          <Separator />

          <CardFooter className="grid grid-cols-2 gap-3">
            <SocialAuthButtons />
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="signup">
        <Card>
          <CardHeader className="text-2xl font-bold">
            <CardTitle>Sign Up</CardTitle>
          </CardHeader>
          <CardContent>
            <SignUpTab openEmailVerificationTab={openEmailVerificationTab} />
          </CardContent>

          <Separator />

          <CardFooter className="grid grid-cols-2 gap-3">
            <SocialAuthButtons />
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="email-verification">
        <Card>
          <CardHeader className="text-2xl font-bold">
            <CardTitle>Verify Your Email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailVerification email={email} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="forgot-password">
        <Card>
          <CardHeader className="text-2xl font-bold">
            <CardTitle>Forgot Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ForgotPassword openSignInTab={() => setSelectedTab("signin")} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
