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
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/constants/routes";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PasskeyButton } from "../buttons/passkey-button";
import { HelpCircle, LogIn } from "lucide-react";
import { signInSchema, SignInForm } from "@/schemas/auth/sign-in";

/**
 * Email/password sign-in form with integrated passkey button and password recovery link.
 * Validates credentials with Zod schema, calls `authClient.signIn.email` on submit, and handles
 * unverified email errors by delegating to email verification flow. Includes forgot-password shortcut.
 *
 * @param props.openEmailVerificationTab - Callback invoked with email when EMAIL_NOT_VERIFIED error occurs
 * @param props.openForgotPassword - Callback to switch parent view to forgot-password form
 * @author Maruf Bepary
 */
export function SignInTab({
  openEmailVerificationTab,
  openForgotPassword,
}: {
  openEmailVerificationTab: (email: string) => void;
  openForgotPassword: () => void;
}) {
  const router = useRouter();
  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Attempts to authenticate with email and password and handles verification errors.
   * @param data Form submission payload containing credentials.
   */
  async function handleSignIn(data: SignInForm) {
    await authClient.signIn.email(
      { ...data, callbackURL: ROUTES.HOME.path },
      {
        onError: (error) => {
          if (error.error.code === "EMAIL_NOT_VERIFIED") {
            openEmailVerificationTab(data.email);
          }
          toast.error(error.error.message || "Failed to sign in");
        },
        onSuccess: () => {
          router.push(ROUTES.HOME.path);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD && (
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(handleSignIn)}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Password</FormLabel>
                    <Button
                      onClick={openForgotPassword}
                      type="button"
                      variant="link"
                      size="sm"
                      className="text-sm font-normal underline"
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Forgot password?
                    </Button>
                  </div>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <LoadingSwap isLoading={isSubmitting}>
                <div className="flex items-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </div>
              </LoadingSwap>
            </Button>
          </form>
        </Form>
      )}
      <PasskeyButton />
    </div>
  );
}
