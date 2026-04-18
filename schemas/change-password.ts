import z from "zod";

/**
 * Validates the change-password form for authenticated users.
 * Used in the profile settings page. revokeOtherSessions controls whether existing sessions are invalidated after the password change.
 *
 * @author Maruf Bepary
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  revokeOtherSessions: z.boolean(),
});

/**
 * Inferred TypeScript type for the change-password form.
 *
 * @author Maruf Bepary
 */
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
