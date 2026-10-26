import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { ingestKbDocumentFunction } from "@/lib/inngest/functions/kb-ingest";
import { reindexKbFunction } from "@/lib/inngest/functions/kb-reindex";
import { executeTransformRun } from "@/lib/inngest/functions/transform-run";
import { executeTranslationWorkflow } from "@/lib/inngest/functions/translation";

/**
 * Array of all Inngest functions registered in the application.
 */
export const inngestFunctions = [
  executeTransformRun,
  generateChatResponse,
  ingestKbDocumentFunction,
  reindexKbFunction,
  executeTranslationWorkflow,
];
