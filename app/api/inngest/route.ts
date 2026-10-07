import { serve } from "inngest/next";
import { env } from "@/config/env";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

const isDev = env.NODE_ENV !== "production";

/**
 * Inngest HTTP serve handler for Next.js App Router.
 * Handles event dispatching, function execution, and step checkpointing.
 *
 * When running with Inngest dev server in a container (Podman/Docker), serveOrigin
 * directs Inngest execution callbacks back to host.docker.internal:3000.
 *
 * @author Maruf Bepary
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
  serveOrigin:
    env.INNGEST_SERVE_ORIGIN ||
    (isDev ? "http://host.docker.internal:3000" : undefined),
});
