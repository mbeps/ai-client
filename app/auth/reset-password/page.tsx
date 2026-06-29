import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import ResetPasswordForm from "./_components/reset-password-form";

export const metadata = {
  title: "Reset Password",
};

/**
 * Password reset completion page that processes signed reset tokens from password reset emails.
 * Server-rendered page that wraps client-rendered form in Suspense boundary to enable useSearchParams.
 * Reads reset token and error state from URL search params; feature flag controlled.
 * Security: Validates token signature; shows invalid-link state for expired or tampered tokens.
 *
 * @author Maruf Bepary
 * @see ForgotPassword for the form that initiates the password reset email flow
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
