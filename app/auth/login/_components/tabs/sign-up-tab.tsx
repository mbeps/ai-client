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
import { UserPlus } from "lucide-react";
import { signUpSchema, SignUpForm } from "@/schemas/auth/sign-up";

/**
 * User registration form that creates a new account with email, name, and password.
 * Validates input with Zod schema, calls `authClient.signUp.email`, and delegates to
 * email verification flow when the new account requires email verification.
 *
 * @param props.openEmailVerificationTab - Callback invoked with email to show verification step after successful signup
 * @author Maruf Bepary
 */
export function SignUpTab({
  openEmailVerificationTab,
}: {
  openEmailVerificationTab: (email: string) => void;
}) {
  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Registers a user with email and password and prompts for verification if needed.
   * @param data Form payload containing the new account information.
   */
  async function handleSignUp(data: SignUpForm) {
    const res = await authClient.signUp.email(
      { ...data, callbackURL: ROUTES.HOME.path },
      {
        onError: (error) => {
          toast.error(error.error.message || "Failed to sign up");
        },
      },
    );

    if (res.error == null && !res.data.user.emailVerified) {
      openEmailVerificationTab(data.email);
    }
  }

  return (
    <div className="space-y-4">
      {env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD ? (
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(handleSignUp)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <LoadingSwap isLoading={isSubmitting}>
                <div className="flex items-center">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </div>
              </LoadingSwap>
            </Button>
          </form>
        </Form>
      ) : (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Email registration is currently disabled.
        </div>
      )}
    </div>
  );
}
