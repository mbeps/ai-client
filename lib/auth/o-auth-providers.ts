import { DiscordIcon, GitHubIcon } from "@/components/auth/icons/o-auth-icons";
import { ComponentProps, ElementType } from "react";

/**
 * OAuth providers enabled in the application.
 * Extend this tuple to add new providers; the type system propagates the change
 * automatically to `SupportedOAuthProvider` and `SUPPORTED_OAUTH_PROVIDER_DETAILS`.
 *
 */
export const SUPPORTED_OAUTH_PROVIDERS = ["github", "discord"] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

/**
 * Display metadata for each supported OAuth provider.
 * Consumed by the login page to render labelled, branded sign-in buttons.
 *
 */
export const SUPPORTED_OAUTH_PROVIDER_DETAILS: Record<
  SupportedOAuthProvider,
  { name: string; Icon: ElementType<ComponentProps<"svg">> }
> = {
  discord: { name: "Discord", Icon: DiscordIcon },
  github: { name: "GitHub", Icon: GitHubIcon },
};
