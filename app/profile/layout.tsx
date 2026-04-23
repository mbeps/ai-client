"use client";

import { ProfileSidebar } from "@/components/sidebar/profile-sidebar";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

/**
 * Authentication-guarded layout for all profile routes.
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
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </div>
    </AuthenticatedLayout>
  );
}

