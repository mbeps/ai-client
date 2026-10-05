import { Inngest } from "inngest";
import { env } from "@/config/env";

const isDev =
  env.INNGEST_DEV === "1" ||
  env.INNGEST_DEV === "true" ||
  env.NODE_ENV !== "production" ||
  !env.INNGEST_SIGNING_KEY;
!env.INNGEST_SIGNING_KEY || env.INNGEST_SIGNING_KEY === "local";

/**
 * Central Inngest client instance for ai-client application.
 * Configured for durable background jobs, workflow execution, and realtime streaming.
 */
export const inngest = new Inngest({
  id: "ai-client",
  isDev,
  baseUrl:
    env.INNGEST_BASE_URL || (isDev ? "http://127.0.0.1:8288" : undefined),
  eventKey:
    env.INNGEST_EVENT_KEY && env.INNGEST_EVENT_KEY !== "local"
      ? env.INNGEST_EVENT_KEY
      : undefined,
  signingKey:
    env.INNGEST_SIGNING_KEY && env.INNGEST_SIGNING_KEY !== "local"
      ? env.INNGEST_SIGNING_KEY
      : undefined,
});
