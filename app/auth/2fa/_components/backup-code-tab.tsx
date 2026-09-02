"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { ROUTES } from "@/constants/routes";
import { authClient } from "@/lib/auth/auth-client";
import {
  type BackupCodeForm,
  backupCodeSchema,
} from "@/schemas/auth/backup-code";

/**
 * Two-factor authentication fallback component that validates a static backup code.
 * Provides an alternative 2FA verification method when the user cannot access their authenticator app.
 * Validates input with Zod schema, calls `authClient.twoFactor.verifyBackupCode` on submit,
 * and redirects to home on success. Includes loading state and error toast notifications.
 *
 * @author Maruf Bepary
 * @see TotpForm for the primary TOTP-based 2FA verification
 */
export function BackupCodeTab() {
  const router = useRouter();
  const form = useForm<BackupCodeForm>({
    resolver: zodResolver(backupCodeSchema),
    defaultValues: {
      code: "",
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Validates a backup code and redirects to the home page on success.
   * @param data Form payload containing the backup code.
   */
  async function handleBackupCodeVerification(data: BackupCodeForm) {
    await authClient.twoFactor.verifyBackupCode(data, {
      onError: (error) => {
        toast.error(error.error.message || "Failed to verify code");
      },
      onSuccess: () => {
        router.push(ROUTES.HOME.path);
      },
    });
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(handleBackupCodeVerification)}
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Backup Code</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          <LoadingSwap isLoading={isSubmitting}>
            <div className="flex items-center">
              <Check className="mr-2 h-4 w-4" />
              Verify
            </div>
          </LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}
