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
import {
  forgotPasswordSchema,
  ForgotPasswordForm,
} from "@/schemas/forgot-password";

/**
 * Form that sends a Better Auth password reset email to the supplied address.
 * On success, a Sonner toast confirms dispatch; the reset link redirects to
 * `ROUTES.AUTH.RESET_PASSWORD`. Includes a Back button to return to sign-in.
 *
 * @param props.openSignInTab - Callback that switches the parent view back to sign-in
 * @author Maruf Bepary
 */
export function ForgotPassword({
  openSignInTab,
}: {
  openSignInTab: () => void;
}) {
  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Sends a password reset email and reports success via toast notifications.
   * @param data Form payload containing the email address.
   */
  async function handleForgotPassword(data: ForgotPasswordForm) {
    await authClient.requestPasswordReset(
      {
        ...data,
        redirectTo: ROUTES.AUTH.RESET_PASSWORD.path,
      },
      {
        onError: (error) => {
          toast.error(
            error.error.message || "Failed to send password reset email",
          );
        },
        onSuccess: () => {
          toast.success("Password reset email sent");
        },
      },
    );
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(handleForgotPassword)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={openSignInTab}>
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            <LoadingSwap isLoading={isSubmitting}>Send Reset Email</LoadingSwap>
          </Button>
        </div>
      </form>
    </Form>
  );
}
