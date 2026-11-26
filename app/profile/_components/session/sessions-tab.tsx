import type { Session } from "better-auth";
import { APIError } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionManagement } from "@/app/profile/_components/session/session-management";
import { ROUTES } from "@/config/routes";
import { db } from "@/drizzle/db";
import { session as sessionTable } from "@/drizzle/schemas/auth-schema";
import { auth } from "@/lib/auth/auth";

/**
 * Fetches active sessions for the current user, falling back to a direct DB query
 * when Better Auth rejects the request with SESSION_NOT_FRESH (sessions older than
 * the default 24h freshAge remain valid for 7 days).
 */
async function loadActiveSessions(userId: string): Promise<Session[]> {
  try {
    return await auth.api.listSessions({ headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 401 || error.status === "UNAUTHORIZED") {
        redirect(ROUTES.AUTH.LOGIN.path);
      }
      if (
        error.statusCode === 403 ||
        error.status === "FORBIDDEN" ||
        error.body?.code === "SESSION_NOT_FRESH"
      ) {
        return db
          .select()
          .from(sessionTable)
          .where(
            and(
              eq(sessionTable.userId, userId),
              gt(sessionTable.expiresAt, new Date()),
            ),
          );
      }
    }
    throw error;
  }
}

/**
 * Server component that fetches all user sessions and renders management controls.
 * Displays the current session and allows revoking other active device sessions.
 *
 * @author Maruf Bepary
 */
export async function SessionsTab({
  currentSessionToken,
  userId,
}: {
  currentSessionToken: string;
  userId: string;
}) {
  const sessions = await loadActiveSessions(userId);

  return (
    <SessionManagement
      sessions={sessions}
      currentSessionToken={currentSessionToken}
    />
  );
}
