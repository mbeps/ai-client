"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";

/**
 * Retrieves the authenticated session for the current request.
 * This server-only function validates the session token from request headers
 * and throws an error if the user is not authenticated.
 * Use in Server Actions and API routes to protect endpoints requiring authentication.
 *
 * @returns The authenticated session object containing user information and metadata
 * @throws {AppException} UNAUTHORIZED when no valid session is found for the current request
 * @author Maruf Bepary
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new AppException({
      code: ERROR_CODE.UNAUTHORIZED,
      message: "Unauthorized",
    });
  }
  return session;
}
