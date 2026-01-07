"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { authClient } from "@/lib/auth/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import QRCode from "react-qr-code";
import {
  twoFactorAuthSchema,
  TwoFactorAuthForm,
  qrSchema,
  QrForm,
} from "@/schemas/two-factor-auth";
type TwoFactorData = {
  totpURI: string;
  backupCodes: string[];
};

/**
 * Manages enabling or disabling TOTP-based two-factor authentication.
 * @param isEnabled Flag indicating whether 2FA is already active.
 * @returns Two-factor form that switches between enable and disable states.
 */
export function TwoFactorAuth({ isEnabled }: { isEnabled: boolean }) {
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorData | null>(
    null
  );
  const router = useRouter();
  const form = useForm<TwoFactorAuthForm>({
    resolver: zodResolver(twoFactorAuthSchema),
    defaultValues: { password: "" },
  });

  const { isSubmitting } = form.formState;

  /**
   * Disables two-factor authentication after verifying the user's password.
   * @param data Form payload containing the account password.
   */
  async function handleDisableTwoFactorAuth(data: TwoFactorAuthForm) {
    await authClient.twoFactor.disable(
      {
        password: data.password,
      },
      {
        onError: (error) => {
          toast.error(error.error.message || "Failed to disable 2FA");
        },
        onSuccess: () => {
          form.reset();
          router.refresh();
        },
      }
    );
  }

  /**
   * Enables two-factor authentication and displays verification instructions.
   * @param data Form payload containing the account password.
   */
  async function handleEnableTwoFactorAuth(data: TwoFactorAuthForm) {
    const result = await authClient.twoFactor.enable({
      password: data.password,
    });

    if (result.error) {
      toast.error(result.error.message || "Failed to enable 2FA");
    }
    {
      setTwoFactorData(result.data);
      form.reset();
    }
  }

  if (twoFactorData != null) {
    return (
      <QRCodeVerify
        {...twoFactorData}
        onDone={() => {
          setTwoFactorData(null);
        }}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(
          isEnabled ? handleDisableTwoFactorAuth : handleEnableTwoFactorAuth
        )}
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          variant={isEnabled ? "destructive" : "default"}
        >
          <LoadingSwap isLoading={isSubmitting}>
            {isEnabled ? "Disable 2FA" : "Enable 2FA"}
          </LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}

/**
 * Verifies a newly enabled TOTP setup and reveals backup codes.
 * @param totpURI QR code value produced by Better Auth.
 * @param backupCodes Codes that can be used when the authenticator is unavailable.
 * @param onDone Callback invoked when the verification flow completes.
 * @returns Verification form and backup code viewer.
 */
function QRCodeVerify({
  totpURI,
  backupCodes,
  onDone,
}: TwoFactorData & { onDone: () => void }) {
  const [successfullyEnabled, setSuccessfullyEnabled] = useState(false);
  const router = useRouter();
  const form = useForm<QrForm>({
    resolver: zodResolver(qrSchema),
    defaultValues: { token: "" },
  });

  const { isSubmitting } = form.formState;

  /**
   * Verifies the TOTP code entered by the user to finalize 2FA setup.
   * @param data Form payload containing the 6-digit token.
   */
  async function handleQrCode(data: QrForm) {
    await authClient.twoFactor.verifyTotp(
      {
        code: data.token,
      },
      {
        onError: (error) => {
          toast.error(error.error.message || "Failed to verify code");
        },
        onSuccess: () => {
          setSuccessfullyEnabled(true);
          router.refresh();
        },
      }
    );
  }

  if (successfullyEnabled) {
    return (
      <>
        <p className="text-sm text-muted-foreground mb-2">
          Save these backup codes in a safe place. You can use them to access
          your account.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {backupCodes.map((code, index) => (
            <div key={index} className="font-mono text-sm">
              {code}
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Scan this QR code with your authenticator app and enter the code below:
      </p>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleQrCode)}>
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <LoadingSwap isLoading={isSubmitting}>Submit Code</LoadingSwap>
          </Button>
        </form>
      </Form>
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 bg-white">
          <QRCode size={256} value={totpURI} />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Or enter this code manually:
          </p>
          <code className="bg-muted px-2 py-1 rounded text-sm font-mono break-all">
            {new URL(totpURI).searchParams.get("secret")}
          </code>
        </div>
      </div>
    </div>
  );
}
