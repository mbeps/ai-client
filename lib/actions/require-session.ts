"use server";

import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

/**
 * Retrieves the authenticated session for the current request.
 * This server-only function validates the session token from request headers
 * and throws an error if the user is not authenticated.
 * Use in Server Actions and API routes to protect endpoints requiring authentication.
 *
 * @returns The authenticated session object containing user information and metadata
 * @throws {Error} "Unauthorized" when no valid session is found for the current request
 * @author Maruf Bepary
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}
