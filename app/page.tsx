"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import Link from "next/link";

/**
 * Landing page that surfaces navigation options based on session state.
 * @returns Client-rendered home page component.
 */
export default function Home() {
  const { data: session, isPending: loading } = authClient.useSession();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="my-6 px-4 max-w-md mx-auto">
      <div className="text-center space-y-6">
        {session == null ? (
          <>
            <h1 className="text-3xl font-bold">Welcome to Our App</h1>
            <Button asChild size="lg">
              <Link href={ROUTES.AUTH.LOGIN}>Sign In / Sign Up</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Welcome {session.user.name}!</h1>
            <div className="flex gap-4 justify-center">
              <Button asChild size="lg">
                <Link href={ROUTES.PROFILE}>Profile</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
