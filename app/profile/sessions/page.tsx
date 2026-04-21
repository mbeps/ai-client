import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionsTab } from "../_components/session/sessions-tab";
import { LoadingSuspense } from "../_components/shared/loading-suspense";

/**
 * Sessions management page.
 * @returns Server-rendered active sessions list.
 */
export default async function SessionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Active Sessions</h2>
        <p className="text-muted-foreground">
          View and manage the devices where you are currently logged in.
        </p>
      </div>
      <LoadingSuspense>
        <SessionsTab currentSessionToken={session.session.token} />
      </LoadingSuspense>
    </div>
  );
}
