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
import { Check, ShieldCheck, ShieldX } from "lucide-react";
import {
  twoFactorAuthSchema,
  TwoFactorAuthForm,
  qrSchema,
  QrForm,
} from "@/schemas/auth/two-factor-auth";
type TwoFactorData = {
  totpURI: string;
  backupCodes: string[];
};

/**
 * Form for enabling or disabling TOTP-based two-factor authentication with password verification.
 * When enabling, displays QR code and backup codes. This is a sensitive operation requiring password confirmation.
 *
 * @author Maruf Bepary
 */
export function TwoFactorAuth({ isEnabled }: { isEnabled: boolean }) {
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorData | null>(
    null,
  );
  const router = useRouter();
  const form = useForm<TwoFactorAuthForm>({
    resolver: zodResolver(twoFactorAuthSchema),
    defaultValues: { password: "" },
  });

  const { isSubmitting } = form.formState;

  /**
   * Disables 2FA after password verification via Better Auth.
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
      },
    );
  }

  /**
   * Enables 2FA and displays TOTP QR code and backup codes for user verification.
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
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(
          isEnabled ? handleDisableTwoFactorAuth : handleEnableTwoFactorAuth,
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
          className="w-full md:w-auto md:self-end"
          variant={isEnabled ? "destructive" : "default"}
        >
          <LoadingSwap isLoading={isSubmitting}>
            <div className="flex items-center">
              {isEnabled ? (
                <>
                  <ShieldX className="mr-2 h-4 w-4" />
                  Disable 2FA
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Enable 2FA
                </>
              )}
            </div>
          </LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}

/**
 * Renders QR code with TOTP setup form and displays backup codes after successful verification.
 * Users enter the 6-digit code from their authenticator app to finalize 2FA activation.
 *
 * @author Maruf Bepary
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
   * Submits TOTP verification code to complete 2FA setup and display backup codes.
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
      },
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
          <Check className="mr-2 h-4 w-4" />
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
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(handleQrCode)}
        >
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

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto md:self-end"
          >
            <LoadingSwap isLoading={isSubmitting}>
              <div className="flex items-center">
                <Check className="mr-2 h-4 w-4" />
                Submit Code
              </div>
            </LoadingSwap>
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
