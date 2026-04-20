import React, { Suspense } from "react";
import ResetPasswordForm from "./_components/reset-password-form";

export const metadata = {
  title: "Reset Password",
};

/**
 * Password reset page that wraps the client-side reset form in a Suspense boundary.
 * Route: /auth/reset-password. The inner form reads the reset token from search params.
 *
 * @author Maruf Bepary
 */
export default function ResetPasswordPage() {
  return (
    <main>
      <Suspense>
        {/* Client component handles useSearchParams and form logic */}
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
