"use client";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { EntityOptions } from "@/components/shared/entity-options";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all protected main app routes.
 * Renders sidebar navigation and entity options header within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 * Route group: /chats, /assistants, /projects, /settings.
 *
 * @param children - Route content (chats, assistants, projects, etc.).
 * @returns Main app scaffold with sidebar, header menu, and nested page content.
 * @see AuthenticatedLayout for session validation and auth guards.
 * @author Maruf Bepary
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
