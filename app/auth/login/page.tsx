"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignUpTab } from "./_components/tabs/sign-up-tab";
import { SignInTab } from "./_components/tabs/sign-in-tab";
import { Separator } from "@/components/ui/separator";
import { SocialAuthButtons } from "./_components/buttons/social-auth-buttons";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { EmailVerification } from "./_components/forms/email-verification";
import { ForgotPassword } from "./_components/forms/forgot-password";

const TAB_VALUES = {
  SIGN_IN: "signin",
  SIGN_UP: "signup",
  EMAIL_VERIFICATION: "email-verification",
  FORGOT_PASSWORD: "forgot-password",
} as const;

type Tab = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

/**
 * Auth entry point that combines sign-in, sign-up, verification, and reset flows.
 * @returns Client-rendered login page with tabbed navigation.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [selectedTab, setSelectedTab] = useState<Tab>(TAB_VALUES.SIGN_IN);

  // Redirect authenticated users away from the auth flow.
  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data != null) router.push("/");
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
      className="max-auto w-full my-6 px-4"
    >
      {(selectedTab === TAB_VALUES.SIGN_IN ||
        selectedTab === TAB_VALUES.SIGN_UP) && (
        <TabsList>
          <TabsTrigger value={TAB_VALUES.SIGN_IN}>Sign In</TabsTrigger>
          <TabsTrigger value={TAB_VALUES.SIGN_UP}>Sign Up</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value={TAB_VALUES.SIGN_IN}>
        <Card>
          <CardHeader className="text-2xl font-bold">
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

          <CardFooter className="grid grid-cols-2 gap-3">
            <SocialAuthButtons />
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value={TAB_VALUES.SIGN_UP}>
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

      <TabsContent value={TAB_VALUES.EMAIL_VERIFICATION}>
        <Card>
          <CardHeader className="text-2xl font-bold">
            <CardTitle>Verify Your Email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailVerification email={email} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value={TAB_VALUES.FORGOT_PASSWORD}>
        <Card>
          <CardHeader className="text-2xl font-bold">
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
