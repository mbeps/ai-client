import type { ComponentProps, ElementType } from "react";
import { FaDiscord, FaGithub, FaGoogle } from "react-icons/fa6";

/**
 * OAuth providers enabled in the application.
 * Extend this tuple to add new providers; the type system propagates the change
 * automatically to `SupportedOAuthProvider` and `SUPPORTED_OAUTH_PROVIDER_DETAILS`.
 *
 * @author Maruf Bepary
 */
export const SUPPORTED_OAUTH_PROVIDERS = [
  "google",
  "github",
  "discord",
] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

/**
 * Display metadata for each supported OAuth provider.
 * Consumed by the login page to render labelled, branded sign-in buttons.
 *
 * @author Maruf Bepary
 */
export const SUPPORTED_OAUTH_PROVIDER_DETAILS: Record<
  SupportedOAuthProvider,
  { name: string; Icon: ElementType<ComponentProps<"svg">> }
> = {
  google: { name: "Google", Icon: FaGoogle },
  github: { name: "GitHub", Icon: FaGithub },
  discord: { name: "Discord", Icon: FaDiscord },
};
