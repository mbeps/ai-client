import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

const authHandlers = toNextJsHandler(auth);

/**
 * Better Auth catch-all API route handlers for GET and POST requests.
 * Handles all /api/auth/* paths including OAuth callbacks, sign-in, sign-up, and session management.
 *
 * @author Maruf Bepary
 */
export const { GET, POST } = authHandlers;
