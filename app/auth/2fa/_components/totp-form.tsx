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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { totpSchema, TotpFormData } from "@/schemas/totp";

/**
 * Form that accepts a 6-digit TOTP code during the two-factor challenge.
 * @returns TOTP verification form component.
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
        router.push("/");
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
          <LoadingSwap isLoading={isSubmitting}>Verify</LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}
