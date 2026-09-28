"use client";

import { ChevronLeft, Languages, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { SidebarUserFooter } from "@/components/sidebar/sidebar-user-footer";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/config/routes";

/**
 * Sidebar for the /workflows section.
 * Provides navigation to workflows hub, translation, and step-by-step automations.
 * Includes "Back to Home" navigation and the shared user profile dropdown footer.
 *
 * @param props - Sidebar component props passed down to root container.
 * @returns Workflow navigation sidebar component.
 * @author Maruf Bepary
 */
export function WorkflowSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navigation = [
    {
      name: "All Workflows",
      href: ROUTES.WORKFLOWS.path,
      icon: LayoutGrid,
    },
    {
      name: "Translation",
      href: ROUTES.WORKFLOWS.TRANSLATION.path,
      icon: Languages,
    },
    {
      name: ROUTES.WORKFLOWS.TRANSFORM.name,
      href: ROUTES.WORKFLOWS.TRANSFORM.path,
      icon: List,
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
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
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

      <SidebarUserFooter />
      <SidebarRail />
    </Sidebar>
  );
}
