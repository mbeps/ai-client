"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProfileSidebar } from "@/components/sidebar/profile-sidebar";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DynamicBreadcrumbs } from "@/components/shared/dynamic-breadcrumbs";

/**
 * Authentication-guarded layout for all profile routes.
 * Mirrors the structure of MainLayout but uses ProfileSidebar.
 */
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push(ROUTES.AUTH.LOGIN.path);
    }
  }, [session, isPending, router]);

  if (isPending || !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ProfileSidebar />
      <main className="flex flex-col flex-1 h-screen overflow-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
          <SidebarTrigger />
          <div className="w-full flex-1">
            <DynamicBreadcrumbs />
          </div>
        </header>
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
