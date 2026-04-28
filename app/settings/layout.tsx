"use client";

import { SettingsSidebar } from "@/components/sidebar/settings-sidebar";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all app settings routes.
 * Renders settings sidebar navigation within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 * Route group: /settings/general, /settings/app, /settings/profile, /settings/prompts, /settings/tools.
 *
 * @param children - Settings sub-page content.
 * @returns Settings scaffold with sidebar and centered content area.
 * @see AuthenticatedLayout for session validation and auth guards.
 * @author Maruf Bepary
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout
      sidebar={<SettingsSidebar />}
      contentClassName="overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8">{children}</div>
    </AuthenticatedLayout>
  );
}
