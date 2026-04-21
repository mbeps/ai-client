import { z } from "zod";

export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const passwordField = z
  .string()
  .min(6, "Password must be at least 6 characters");

export const requiredPasswordField = z.string().min(1, "Password is required");
