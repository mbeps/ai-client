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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { backupCodeSchema, BackupCodeForm } from "@/schemas/backup-code";

/**
 * Two-factor authentication fallback that accepts a static backup code.
 * Calls `authClient.twoFactor.verifyBackupCode`; redirects to `ROUTES.HOME` on success.
 * Shown as an alternative to the TOTP form on the 2FA challenge page.
 *
 * @author Maruf Bepary
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
