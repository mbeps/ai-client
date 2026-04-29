import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A layout component that positions tabs vertically on the right side of the content.
 * Wraps the standard Shadcn UI Tabs component but applies sidebar-style layout.
 * 
 * @param props Standard Tabs components props
 */
export function SidebarTabs({ className, ...props }: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      orientation="vertical"
      className={cn("flex flex-col md:flex-row-reverse items-start gap-8", className)}
      {...props}
    />
  );
}

/**
 * The list container for sidebar tabs, styled as a vertical column.
 */
export function SidebarTabsList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "flex flex-col h-auto w-full md:w-52 bg-transparent border-l border-border rounded-none p-0 items-stretch gap-1 shrink-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Individual tab trigger for the sidebar, styled to look like a navigation link.
 */
export function SidebarTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "justify-start px-4 py-3 h-auto data-[state=active]:bg-muted/50 data-[state=active]:text-primary data-[state=active]:shadow-none border-0 border-l-2 border-transparent data-[state=active]:border-primary rounded-none transition-all hover:bg-muted/30 text-left whitespace-normal font-medium font-sans",
        className
      )}
      {...props}
    />
  );
}


/**
 * Re-exporting TabsContent for consistency in naming.
 */
export const SidebarTabsContent = TabsContent;
