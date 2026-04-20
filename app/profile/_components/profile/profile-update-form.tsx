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
        className="space-y-4"
        onSubmit={form.handleSubmit(handleProfileUpdate)}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Email</FormLabel>
          <Input value={user.email} disabled />
          <p className="text-xs text-muted-foreground">
            Email address cannot be changed.
          </p>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          <LoadingSwap isLoading={isSubmitting}>Update Profile</LoadingSwap>
        </Button>
      </form>
    </Form>
  );
}
