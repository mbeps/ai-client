import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import ResetPasswordForm from "./_components/reset-password-form";

export const metadata = {
  title: "Reset Password",
};

/**
 * Password reset page with client-rendered form wrapped in Suspense boundary.
 * Route: /auth/reset-password. Public route. Reads reset token from URL search params.
 * User navigates here via password reset email link from Forgot Password flow.
 *
 * @returns Reset form with token validation and new password confirmation.
 * @see LoginPage for Forgot Password flow that sends reset email.
 */
export default function ResetPasswordPage() {
  if (!env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD) {
    redirect("/auth/login");
  }

  return (
    <main>
      <Suspense>
        {/* Client component handles useSearchParams and form logic */}
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
