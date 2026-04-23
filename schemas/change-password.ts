import { z } from "zod";
import { passwordField, requiredPasswordField } from "./shared-fields";

/**
 * Validates the change-password form for authenticated users.
 * Used in the profile settings page. 
 * revokeOtherSessions controls whether existing sessions are invalidated after the password change.
 *
 * @author Maruf Bepary
 */
export const changePasswordSchema = z.object({
  currentPassword: requiredPasswordField,
  newPassword: passwordField,
  revokeOtherSessions: z.boolean(),
});

/**
 * Inferred TypeScript type for the change-password form.
 *
 * @author Maruf Bepary
 */
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
