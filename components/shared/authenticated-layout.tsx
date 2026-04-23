"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DynamicBreadcrumbs } from "@/components/shared/dynamic-breadcrumbs";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  headerExtra?: React.ReactNode;
  contentClassName?: string;
  showBreadcrumbs?: boolean;
}

/**
 * A shared layout component for authenticated routes.
 * Handles session checking, sidebar state, and consistent header structure.
 *
 * @param children - The main content to render.
 * @param sidebar - The sidebar component to use (e.g., AppSidebar, SettingsSidebar).
 * @param headerExtra - Optional extra components to render in the header (e.g., EntityOptions).
 * @param contentClassName - Optional CSS classes for the content wrapper.
 * @param showBreadcrumbs - Whether to show the breadcrumbs in the header (default: true).
 */
export function AuthenticatedLayout({
  children,
  sidebar,
  headerExtra,
  contentClassName,
  showBreadcrumbs = true,
}: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push(ROUTES.AUTH.LOGIN.path);
    }
  }, [session, isPending, router]);

  if (isPending || !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <SidebarProvider>
      {sidebar}
      <main className="flex flex-col flex-1 h-screen overflow-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
          <SidebarTrigger />
          <div className="w-full flex-1">
            {showBreadcrumbs && <DynamicBreadcrumbs />}
          </div>
          {headerExtra}
        </header>
        <div className={`flex flex-col flex-1 min-h-0 ${contentClassName || "overflow-hidden"}`}>
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
