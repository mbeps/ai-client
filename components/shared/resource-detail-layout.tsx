"use client";

import * as React from "react";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { cn } from "@/lib/utils";

/**
 * Props for the ResourceDetailLayout component.
 */
interface ResourceDetailLayoutProps {
  /** The primary title of the resource. */
  title: string;
  /** Optional supporting description. */
  description?: string;
  /** Breadcrumb elements to render at the top. */
  breadcrumbs: React.ReactNode;
  /** Navigation tabs configuration. */
  tabs: {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  /** Currently active tab ID. */
  activeTab: string;
  /** Callback when tab is changed. */
  onTabChange: (tab: string) => void;
  /** Optional header actions (e.g., buttons). */
  actions?: React.ReactNode;
  /** Tab contents (should include SidebarTabsContent elements). */
  children: React.ReactNode;
  /** Optional additional class name for the container. */
  className?: string;
}

/**
 * A reusable layout for resource detail pages (Projects, Assistants, etc.).
 * Standardises breadcrumbs, header with actions, and vertical sidebar tabs.
 *
 * @author Maruf Bepary
 */
export function ResourceDetailLayout({
  title,
  description,
  breadcrumbs,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
  className,
}: ResourceDetailLayoutProps) {
  return (
    <div className={cn("page-container-detail space-y-6", className)}>
      <div className="space-y-4">
        {breadcrumbs}

        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>

      <SidebarTabs
        value={activeTab}
        onValueChange={onTabChange}
        className="w-full"
      >
        <SidebarTabsList>
          {tabs.map((tab) => (
            <SidebarTabsTrigger key={tab.id} value={tab.id}>
              {tab.icon && <tab.icon className="mr-2 h-4 w-4" />}
              <span>{tab.label}</span>
            </SidebarTabsTrigger>
          ))}
        </SidebarTabsList>

        {children}
      </SidebarTabs>
    </div>
  );
}
