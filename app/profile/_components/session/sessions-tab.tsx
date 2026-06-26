import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { SessionManagement } from "./session-management";

/**
 * Server component that fetches sessions and renders revocation controls.
 * @param currentSessionToken Token representing the active browser session.
 * @returns UI for session management without card wrapper.
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
