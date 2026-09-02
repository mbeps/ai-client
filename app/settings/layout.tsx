"use client";

import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";
import { SettingsSidebar } from "@/components/sidebar/settings-sidebar";

/**
 * Authentication-guarded layout for all app settings routes.
 * Renders settings sidebar navigation within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 * Route group: /settings/general, /settings/app, /settings/profile, /settings/prompts, /settings/tools.
 *
 * @param children Settings sub-page content.
 * @returns Settings scaffold with sidebar and centered content area.
 * @author Maruf Bepary
 * @see AuthenticatedLayout for session validation and auth guards.
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
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
    </AuthenticatedLayout>
  );
}
