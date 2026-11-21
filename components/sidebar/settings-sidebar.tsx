"use client";

import {
  Brain,
  BrainCircuit,
  Command,
  Database,
  Plug,
  Settings,
  Wrench,
} from "lucide-react";
import type * as React from "react";
import {
  type NavSidebarItem,
  NavSidebarShell,
} from "@/components/sidebar/nav-sidebar-shell";
import type { Sidebar } from "@/components/ui/sidebar";
import { ROUTES } from "@/config/routes";

const SETTINGS_NAVIGATION: NavSidebarItem[] = [
  {
    name: "General",
    href: ROUTES.SETTINGS.APP.path,
    icon: Settings,
  },
  {
    name: "Providers",
    href: ROUTES.SETTINGS.PROVIDERS.path,
    icon: Database,
  },
  {
    name: "Prompts",
    href: ROUTES.SETTINGS.PROMPTS.path,
    icon: Command,
  },
  {
    name: "Skills",
    href: ROUTES.SETTINGS.SKILLS.path,
    icon: BrainCircuit,
  },
  {
    name: "Memory",
    href: ROUTES.SETTINGS.MEMORY.path,
    icon: Brain,
  },
  {
    name: "Connectors",
    href: ROUTES.SETTINGS.CONNECTORS.path,
    icon: Plug,
  },
  {
    name: "Tools",
    href: ROUTES.SETTINGS.TOOLS.path,
    icon: Wrench,
  },
];

const SETTINGS_PREFIX_ROUTES: Record<string, string> = {
  Connectors: ROUTES.SETTINGS.CONNECTORS.path,
  Providers: ROUTES.SETTINGS.PROVIDERS.path,
  Prompts: ROUTES.SETTINGS.PROMPTS.path,
  Skills: ROUTES.SETTINGS.SKILLS.path,
  Tools: ROUTES.SETTINGS.TOOLS.path,
  Memory: ROUTES.SETTINGS.MEMORY.path,
};

/**
 * Sidebar for the /settings section.
 * Provides navigation to General (app preferences), Connectors (MCP server management), and Prompts (slash-command shortcuts).
 * "Back to Home" button returns to main chat interface. Active route is highlighted based on `pathname`.
 *
 * @see ROUTES.SETTINGS for available settings page routes
 */
export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <NavSidebarShell
      {...props}
      navigation={SETTINGS_NAVIGATION}
      isItemActive={(item, pathname) => {
        if (pathname === item.href) return true;
        const prefix = SETTINGS_PREFIX_ROUTES[item.name];
        return prefix ? pathname.startsWith(prefix) : false;
      }}
      headerContent={
        <div className="px-3 py-2">
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <p className="text-muted-foreground text-xs">
            Manage your application preferences
          </p>
        </div>
      }
    />
  );
}
