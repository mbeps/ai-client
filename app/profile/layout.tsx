"use client";

import { ProfileSidebar } from "@/components/sidebar/profile-sidebar";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all user profile routes.
 * Renders profile sidebar navigation within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 * Route group: /profile/general, /profile/accounts, /profile/security, /profile/sessions, /profile/danger.
 *
 * @param children - Profile sub-page content.
 * @returns Profile scaffold with sidebar and centered content area.
 * @see AuthenticatedLayout for session validation and auth guards.
 * @author Maruf Bepary
 */
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout
      sidebar={<ProfileSidebar />}
      contentClassName="overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8">{children}</div>
    </AuthenticatedLayout>
  );
}
