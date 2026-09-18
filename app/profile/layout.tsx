"use client";

import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";
import { PageContainer } from "@/components/shared/page-container";
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
    <AuthenticatedLayout sidebar={<ProfileSidebar />}>
      <PageContainer variant="default">{children}</PageContainer>
    </AuthenticatedLayout>
  );
}
