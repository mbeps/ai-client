"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Settings, Wrench, ChevronLeft, LogOut, Command } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";

/**
 * Sidebar for the Application Settings section.
 * Displays links to app-wide settings and tools.
 */
export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();

  const navigation = [
    {
      name: "General",
      href: ROUTES.SETTINGS.APP.path,
      icon: Settings,
    },
    {
      name: "Tools",
      href: ROUTES.SETTINGS.TOOLS.path,
      icon: Wrench,
    },
    {
      name: "Prompts",
      href: ROUTES.SETTINGS.PROMPTS.path,
      icon: Command,
    },
  ];

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Home">
              <Link href={ROUTES.HOME.path} className="font-semibold">
                <ChevronLeft className="size-4" />
                <span>Back to Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator className="mx-0 my-2" />
          <SidebarMenuItem>
            <div className="px-3 py-2">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
              <p className="text-xs text-muted-foreground">
                Manage your application preferences
              </p>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === item.href ||
                    (item.name === "Tools" &&
                      pathname.startsWith(ROUTES.SETTINGS.TOOLS.path)) ||
                    (item.name === "Prompts" &&
                      pathname.startsWith(ROUTES.SETTINGS.PROMPTS.path))
                  }
                  tooltip={item.name}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await authClient.signOut();
                router.push(ROUTES.AUTH.LOGIN.path);
              }}
              className="text-destructive hover:text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
