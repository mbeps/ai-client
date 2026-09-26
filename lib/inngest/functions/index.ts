import { generateChatResponse } from "./chat-response";
import { ingestKbDocumentFunction } from "./kb-ingest";
import { reindexKbFunction } from "./kb-reindex";
import { executeTransformRun } from "./transform-run";
import { executeTranslationWorkflow } from "./translation";

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
