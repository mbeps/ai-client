"use client";

import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Post-registration panel that prompts users to verify their email address.
 * Enforces a 30-second cooldown between resend attempts using a countdown timer.
 * Shown automatically after sign-up when `user.emailVerified` is `false`.
 *
 * @param props.email - Address to send the verification link to
 * @author Maruf Bepary
 */
export function EmailVerification({ email }: { email: string }) {
  const [timeToNextResend, setTimeToNextResend] = useState(30);
  const interval = useRef<NodeJS.Timeout>(undefined);

  /**
   * Starts a countdown that prevents immediate resend spam.
   * @param time Countdown duration in seconds.
   */
  function startEmailVerificationCountdown(time = 30) {
    setTimeToNextResend(time);

    clearInterval(interval.current);
    interval.current = setInterval(() => {
      setTimeToNextResend((t) => {
        const newT = t - 1;

        if (newT <= 0) {
          clearInterval(interval.current);
          return 0;
        }
        return newT;
      });
    }, 1000);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial countdown setup is intentional
    startEmailVerificationCountdown();
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mt-2">
        We sent you a verification link. Please check your email and click the
        link to verify your account.
      </p>

      <BetterAuthActionButton
        variant="outline"
        className="w-full"
        successMessage="Verification email sent!"
        disabled={timeToNextResend > 0}
        action={() => {
          startEmailVerificationCountdown();
          return authClient.sendVerificationEmail({
            email,
            callbackURL: ROUTES.HOME.path,
          });
        }}
      >
        <Mail className="mr-2 h-4 w-4" />
        {timeToNextResend > 0
          ? `Resend Email (${timeToNextResend})`
          : "Resend Email"}
      </BetterAuthActionButton>
    </div>
  );
}
