"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Authentication-guarded layout for all main app routes.
 * Performs a client-side session check; redirects unauthenticated users to /auth/login.
 * Wraps authenticated content with SidebarProvider and AppSidebar.
 *
 * @param children - Authenticated page content.
 * @returns Sidebar layout shell, or a loading screen while the session resolves.
 * @author Maruf Bepary
 */
export default function MainLayout({
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
      <AppSidebar />
      <main className="flex flex-col flex-1 h-screen overflow-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
          <SidebarTrigger />
          <div className="w-full flex-1">
            {/* Header content like title or global tools can go here */}
          </div>
        </header>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
