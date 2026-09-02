"use client";

import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";
import { ProfileSidebar } from "@/components/sidebar/profile-sidebar";

/**
 * Authentication-guarded layout for all user profile routes.
 * Renders profile sidebar navigation within AuthenticatedLayout.
 * Requires active session — redirects unauthenticated users to login.
 * Route group: /profile/general, /profile/accounts, /profile/security, /profile/sessions, /profile/danger.
 *
 * @param children - Profile sub-page content.
 * @returns Profile scaffold with sidebar and centered content area.
 * @see AuthenticatedLayout for session validation and auth guards.
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
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
    </AuthenticatedLayout>
  );
}
