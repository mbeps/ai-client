"use client";

import { Key, LinkIcon, Shield, Trash2, User } from "lucide-react";
import type * as React from "react";
import {
  type NavSidebarItem,
  NavSidebarShell,
} from "@/components/sidebar/nav-sidebar-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Sidebar } from "@/components/ui/sidebar";
import { ROUTES } from "@/config/routes";
import { authClient } from "@/lib/auth/auth-client";

const PROFILE_NAVIGATION: NavSidebarItem[] = [
  {
    name: "General",
    href: ROUTES.PROFILE.GENERAL.path,
    icon: User,
  },
  {
    name: "Security",
    href: ROUTES.PROFILE.SECURITY.path,
    icon: Shield,
  },
  {
    name: "Sessions",
    href: ROUTES.PROFILE.SESSIONS.path,
    icon: Key,
  },
  {
    name: "Linked Accounts",
    href: ROUTES.PROFILE.ACCOUNTS.path,
    icon: LinkIcon,
  },
  {
    name: "Danger Zone",
    href: ROUTES.PROFILE.DANGER.path,
    icon: Trash2,
  },
];

/**
 * Sidebar for the /profile section.
 * Displays user avatar, name, and email; provides navigation to General, Security, Sessions, Linked Accounts,
 * and Danger Zone (account deletion) pages. "Back to Home" button returns to main chat interface.
 *
 * @see ROUTES.PROFILE for available profile page routes
 */
export function ProfileSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession();

  return (
    <NavSidebarShell
      {...props}
      navigation={PROFILE_NAVIGATION}
      headerContent={
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage
              src={session?.user?.image || undefined}
              alt={session?.user?.name || ""}
            />
            <AvatarFallback className="rounded-lg">
              {session?.user?.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {session?.user?.name}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {session?.user?.email}
            </span>
          </div>
        </div>
      }
    />
  );
}
