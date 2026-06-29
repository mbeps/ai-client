"use client";

import { WorkflowSidebar } from "@/components/sidebar/workflow-sidebar";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all workflow routes.
 * Renders workflow sidebar navigation within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 *
 * @author Maruf Bepary
 */
export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout
      sidebar={<WorkflowSidebar />}
      contentClassName="overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6">{children}</div>
    </AuthenticatedLayout>
  );
}
