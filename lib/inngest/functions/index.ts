import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { ingestKbDocumentFunction } from "@/lib/inngest/functions/kb-ingest";
import { reindexKbFunction } from "@/lib/inngest/functions/kb-reindex";
import { executeTranslationWorkflow } from "@/lib/inngest/functions/translation";
import { executeWorkflowRun } from "@/lib/inngest/functions/workflow-run";

/**
 * Array of all Inngest functions registered in the application.
 */
export const inngestFunctions = [
  executeWorkflowRun,
  generateChatResponse,
  ingestKbDocumentFunction,
  reindexKbFunction,
  executeTranslationWorkflow,
];
