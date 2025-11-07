import { DiscordIcon, GitHubIcon } from "@/components/auth/o-auth-icons"
import { ComponentProps, ElementType } from "react"

/**
 * OAuth providers enabled in the demo experience.
 */
export const SUPPORTED_OAUTH_PROVIDERS = ["github", "discord"] as const
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number]

/**
 * Provider metadata used to render provider-specific UI affordances.
 */
export const SUPPORTED_OAUTH_PROVIDER_DETAILS: Record<
  SupportedOAuthProvider,
  { name: string; Icon: ElementType<ComponentProps<"svg">> }
> = {
  discord: { name: "Discord", Icon: DiscordIcon },
  github: { name: "GitHub", Icon: GitHubIcon },
}
