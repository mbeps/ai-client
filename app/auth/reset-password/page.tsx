import React, { Suspense } from "react"
import ResetPasswordForm from "./_components/reset-password-form"

export const metadata = {
  title: "Reset Password",
}

export default function ResetPasswordPage() {
  return (
    <main>
      <Suspense>
        {/* Client component handles useSearchParams and form logic */}
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
