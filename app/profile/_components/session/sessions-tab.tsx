import { headers } from "next/headers";
import { SessionManagement } from "@/app/profile/_components/session/session-management";
import { auth } from "@/lib/auth/auth";

/**
 * Server component that fetches all user sessions and renders management controls.
 * Displays the current session and allows revoking other active device sessions.
 *
 * @author Maruf Bepary
 */
export async function SessionsTab({
  currentSessionToken,
}: {
  currentSessionToken: string;
}) {
  const sessions = await auth.api.listSessions({ headers: await headers() });

  return (
    <SessionManagement
      sessions={sessions}
      currentSessionToken={currentSessionToken}
    />
  );
}
