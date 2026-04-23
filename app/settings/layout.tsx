"use client";

import { SettingsSidebar } from "@/components/sidebar/settings-sidebar";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all settings routes.
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
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </div>
    </AuthenticatedLayout>
  );
}

