import { Inngest } from "inngest";
import { env } from "@/config/env";
import {
  isDevMode,
  resolveInngestEventKey,
  resolveInngestSigningKey,
} from "./run-service/run-metadata";

const isDev = isDevMode();

/**
 * Central Inngest client instance for ai-client application.
 * Configured for durable background jobs, workflow execution, and realtime streaming.
 */
export const inngest = new Inngest({
  id: "ai-client",
  isDev,
  baseUrl:
    env.INNGEST_BASE_URL || (isDev ? "http://127.0.0.1:8288" : undefined),
  eventKey: resolveInngestEventKey(),
  signingKey: resolveInngestSigningKey(),
});
