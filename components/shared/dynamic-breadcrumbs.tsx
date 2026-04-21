"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useAppStore } from "@/lib/store";

/**
 * Friendly labels for known route segments.
 */
const ROUTE_LABELS: Record<string, string> = {
  chats: "Chats",
  projects: "Projects",
  assistants: "Assistants",
  knowledgebases: "Knowledge Bases",
  tools: "Tools",
  profile: "Profile",
  security: "Security",
  sessions: "Sessions",
  accounts: "Linked Accounts",
  danger: "Danger Zone",
  general: "General",
  settings: "Settings",
};

/**
 * Dynamic breadcrumb component that generates navigation links based on the current URL.
 * Automatically maps technical path segments to user-friendly labels.
 *
 * @returns A Shadcn UI Breadcrumb component or null if at the root.
 */
export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const { chats, projects, assistants, knowledgebases } = useAppStore();
  
  // Split pathname into segments and remove empty strings
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          
          // Map segment to label or capitalise it
          const label = 
            chats[segment]?.title ||
            projects.find((p) => p.id === segment)?.name ||
            assistants.find((a) => a.id === segment)?.name ||
            knowledgebases.find((kb) => kb.id === segment)?.name ||
            ROUTE_LABELS[segment.toLowerCase()] || 
            segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

          return (
            <React.Fragment key={href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
