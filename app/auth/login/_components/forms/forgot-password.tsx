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
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import {
  forgotPasswordSchema,
  ForgotPasswordForm,
} from "@/schemas/auth/forgot-password";

/**
 * Forgot password form that initiates the password reset flow by sending a reset email.
 * Validates email with Zod schema, calls `authClient.requestPasswordReset`, and shows success/error toasts.
 * Includes a Back button to return to sign-in. Reset link redirects to reset-password page with a signed token.
 *
 * @param props.openSignInTab - Callback to switch parent view back to sign-in tab
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            <LoadingSwap isLoading={isSubmitting}>
              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                Send Reset Email
              </div>
            </LoadingSwap>
          </Button>
        </div>
      </form>
    </Form>
  );
}
