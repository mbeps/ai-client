"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { authClient } from "@/lib/auth/auth-client";
import { env } from "@/lib/env";
import { SocialAuthButtons } from "./_components/buttons/social-auth-buttons";
import { EmailVerification } from "./_components/forms/email-verification";
import { ForgotPassword } from "./_components/forms/forgot-password";
import { SignInTab } from "./_components/tabs/sign-in-tab";
import { SignUpTab } from "./_components/tabs/sign-up-tab";

const TAB_VALUES = {
  SIGN_IN: "signin",
  SIGN_UP: "signup",
  EMAIL_VERIFICATION: "email-verification", // invisible
  FORGOT_PASSWORD: "forgot-password", // invisible
} as const;

type Tab = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

/**
 * Main authentication entry point supporting multiple sign-in and sign-up methods.
 * Client-rendered page with tabbed interface for sign-in, sign-up, email verification, and password recovery.
 * Supports OAuth (GitHub, Discord), email/password with validation, and WebAuthn passkey authentication.
 * Security: Redirects authenticated users to home; handles email verification and 2FA delegation.
 *
 * @author Maruf Bepary
 * @see TwoFactorPage for TOTP/backup code challenges when 2FA is enabled
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [selectedTab, setSelectedTab] = useState<Tab>(TAB_VALUES.SIGN_IN);

  // Redirect authenticated users away from the auth flow.
  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data != null) router.push(ROUTES.HOME.path);
    });
  }, [router]);

  /**
   * Switches to the email verification tab and stores the target email.
   * @param email Address that needs verification.
   */
  function openEmailVerificationTab(email: string) {
    setEmail(email);
    setSelectedTab(TAB_VALUES.EMAIL_VERIFICATION);
  }

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(t) => setSelectedTab(t as Tab)}
      className="mx-auto my-6 max-w-4xl px-4"
    >
      {(selectedTab === TAB_VALUES.SIGN_IN ||
        selectedTab === TAB_VALUES.SIGN_UP) &&
        env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD && (
          <TabsList>
            <TabsTrigger
              value={TAB_VALUES.SIGN_IN}
              className="flex items-center"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value={TAB_VALUES.SIGN_UP}
              className="flex items-center"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </TabsTrigger>
          </TabsList>
        )}
      <TabsContent value={TAB_VALUES.SIGN_IN}>
        <Card>
          <CardHeader className="font-bold text-2xl">
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInTab
              openEmailVerificationTab={openEmailVerificationTab}
              openForgotPassword={() =>
                setSelectedTab(TAB_VALUES.FORGOT_PASSWORD)
              }
            />
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-3">
            <SocialAuthButtons />
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value={TAB_VALUES.SIGN_UP}>
        <Card>
          <CardHeader className="font-bold text-2xl">
            <CardTitle>Sign Up</CardTitle>
          </CardHeader>
          <CardContent>
            <SignUpTab openEmailVerificationTab={openEmailVerificationTab} />
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-3">
            <SocialAuthButtons />
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value={TAB_VALUES.EMAIL_VERIFICATION}>
        <Card>
          <CardHeader className="font-bold text-2xl">
            <CardTitle>Verify Your Email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailVerification email={email} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value={TAB_VALUES.FORGOT_PASSWORD}>
        <Card>
          <CardHeader className="font-bold text-2xl">
            <CardTitle>Forgot Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ForgotPassword
              openSignInTab={() => setSelectedTab(TAB_VALUES.SIGN_IN)}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
