"use client";

import { ChevronLeft, LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type * as React from "react";
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
import { ROUTES } from "@/config/routes";
import { authClient } from "@/lib/auth/auth-client";
import { resetClientState } from "@/lib/store/reset-client-state";

/**
 * Navigation item rendered in NavSidebarShell.
 */
export interface NavSidebarItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Props for the NavSidebarShell component.
 */
export interface NavSidebarShellProps
  extends React.ComponentProps<typeof Sidebar> {
  navigation: NavSidebarItem[];
  headerContent: React.ReactNode;
  isItemActive?: (item: NavSidebarItem, pathname: string) => boolean;
}

/**
 * Shared navigation sidebar shell for /settings and /profile sections.
 * Provides "Back to Home" header link, section header slot, navigation links, and sign-out footer.
 */
export function NavSidebarShell({
  navigation,
  headerContent,
  isItemActive = (item, pathname) => pathname === item.href,
  ...props
}: NavSidebarShellProps) {
  const router = useRouter();
  const pathname = usePathname();

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
          <SidebarMenuItem>{headerContent}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive(item, pathname)}
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
                resetClientState();
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
