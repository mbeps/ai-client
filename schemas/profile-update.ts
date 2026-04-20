import z from "zod";

/**
 * Validates the profile update form.
 * Used with react-hook-form in the profile settings page. Currently only allows updating the display name.
 *
 * @author Maruf Bepary
 */
export const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

/**
 * Inferred TypeScript type for the profile update form.
 *
 * @author Maruf Bepary
 */
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
