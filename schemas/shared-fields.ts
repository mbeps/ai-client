import { z } from "zod";

export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255);

export const passwordField = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100);

export const requiredPasswordField = z
  .string()
  .min(1, "Password is required")
  .max(100);

export const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters");

export const descriptionField = z
  .string()
  .max(500, "Description must be less than 500 characters")
  .optional();

export const renameSchema = z.object({
  name: nameField,
});
