"use client";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { EntityOptions } from "@/components/shared/entity-options";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all main app routes.
 * Wraps authenticated content with SidebarProvider and AppSidebar using the shared AuthenticatedLayout.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout
      sidebar={<AppSidebar />}
      headerExtra={<EntityOptions />}
    >
      {children}
    </AuthenticatedLayout>
  );
}

