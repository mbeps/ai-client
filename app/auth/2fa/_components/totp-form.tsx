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
import { totpSchema, TotpFormData } from "@/schemas/totp";

/**
 * Primary two-factor authentication form that validates a 6-digit TOTP code.
 * Calls `authClient.twoFactor.verifyTotp`; redirects to `ROUTES.HOME` on success.
 * Rendered as the default tab on the 2FA challenge page.
 *
 * @author Maruf Bepary
 */
export function TotpForm() {
  const router = useRouter();
  const form = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
    defaultValues: {
      code: "",
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Verifies the provided TOTP code and redirects to the home page on success.
   * @param data Form payload containing the 6-digit code.
   */
  async function handleTotpVerification(data: TotpFormData) {
    await authClient.twoFactor.verifyTotp(data, {
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
        onSubmit={form.handleSubmit(handleTotpVerification)}
      >
        <FormField
          control={form.control}
          name="code"
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
