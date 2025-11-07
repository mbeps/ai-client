import { auth } from "@/lib/auth/auth"
import { toNextJsHandler } from "better-auth/next-js"

const authHandlers = toNextJsHandler(auth)

/**
 * Next.js route handlers that proxy Better Auth capabilities.
 */
export const { GET, POST } = authHandlers
