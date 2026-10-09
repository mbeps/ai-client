import { serve } from "inngest/next";
import { env } from "@/config/env";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

/**
 * Inngest HTTP serve handler for Next.js App Router.
 * Handles event dispatching, function execution, and step checkpointing.
 *
 * When `INNGEST_SERVE_ORIGIN` is configured, Inngest execution callbacks are directed
 * to that origin. Otherwise, Inngest dynamically determines the origin from incoming request headers.
 *
 * @author Maruf Bepary
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
  serveOrigin: env.INNGEST_SERVE_ORIGIN || undefined,
});
