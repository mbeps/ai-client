import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { SessionManagement } from "./session-management";

/**
 * Server component that fetches sessions and renders revocation controls.
 * @param currentSessionToken Token representing the active browser session.
 * @returns Card containing the session management UI.
 */
export async function SessionsTab({
  currentSessionToken,
}: {
  currentSessionToken: string;
}) {
  const sessions = await auth.api.listSessions({ headers: await headers() });

  return (
    <Card>
      <CardContent>
        <SessionManagement
          sessions={sessions}
          currentSessionToken={currentSessionToken}
        />
      </CardContent>
    </Card>
  );
}
