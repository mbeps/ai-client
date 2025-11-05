import { auth } from "@/lib/auth/auth"
import { toNextJsHandler } from "better-auth/next-js"

const authHandlers = toNextJsHandler(auth)
export const { GET, POST } = authHandlers
