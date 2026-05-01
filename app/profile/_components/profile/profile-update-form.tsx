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
import { User } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  profileUpdateSchema,
  ProfileUpdateFormData,
} from "@/schemas/profile-update";

/**
 * Form that updates profile metadata.
 * @param user Initial user data used to seed the form.
 * @returns Controlled profile update form component.
 * @author Maruf Bepary
 */
export function ProfileUpdateForm({
  user,
}: {
  user: {
    email: string;
    name: string;
  };
}) {
  const router = useRouter();
  const form = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user.name,
    },
  });

  const { isSubmitting } = form.formState;

  /**
   * Updates profile fields.
   * @param data Form submission containing updated profile values.
   */
  async function handleProfileUpdate(data: ProfileUpdateFormData) {
    const { error } = await authClient.updateUser({
      name: data.name,
    });

    if (error) {
      toast.error(error.message || "Failed to update profile");
    } else {
      toast.success("Profile updated successfully");
      router.refresh();
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(handleProfileUpdate)}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex-1 space-y-2">
            <FormLabel>Email</FormLabel>
            <Input value={user.email} disabled />
            <p className="text-xs text-muted-foreground">
              Email address cannot be changed.
            </p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full md:w-auto md:self-end"
        >
          <LoadingSwap isLoading={isSubmitting}>
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              Update Profile
            </div>
          </LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}
