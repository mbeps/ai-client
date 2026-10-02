import type * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A layout component that positions tabs vertically on the right side of the content.
 * Wraps the standard Shadcn UI Tabs component but applies sidebar-style layout.
 *
 * @param props Standard Tabs components props
 */
export function SidebarTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      orientation="vertical"
      className={cn(
        "flex flex-col items-start gap-8 md:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The list container for sidebar tabs, styled as a vertical column.
 */
export function SidebarTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "flex h-auto w-full shrink-0 flex-col items-stretch gap-1 rounded-none border-border border-l bg-transparent p-0 md:w-52",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Individual tab trigger for the sidebar, styled to look like a navigation link.
 */
export function SidebarTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "h-auto justify-start whitespace-normal rounded-none border-0 border-transparent border-l-2 px-4 py-3 text-left font-medium font-sans transition-all hover:bg-muted/30 data-[state=active]:border-primary data-[state=active]:bg-muted/50 data-[state=active]:text-primary data-[state=active]:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Re-exporting TabsContent for consistency in naming.
 */
export const SidebarTabsContent = TabsContent;
