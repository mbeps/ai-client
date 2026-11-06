import { NonRetriableError } from "inngest";
import { ERROR_CODE } from "@/lib/error/error-code";
import { toAppError } from "@/lib/error/to-app-error";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { ingestDocument } from "@/lib/rag/ingest";

const log = getLogger(["inngest", "kb", "ingest"]);

/**
 * Inngest durable function ingesting a single knowledge base document.
 * Checkpoints extraction, chunking, and embedding creation.
 *
 * @author Maruf Bepary
 */
export const ingestKbDocumentFunction = inngest.createFunction(
  {
    id: "ingest-kb-document",
    singleton: { key: "event.data.documentId", mode: "skip" },
    retries: 2,
    cancelOn: [
      {
        event: "knowledgebase/document.cancel",
        if: "async.data.documentId == event.data.documentId",
      },
      {
        event: "knowledgebase/reindex.cancel",
        if: "async.data.kbId == event.data.kbId",
      },
    ],
    triggers: [{ event: "knowledgebase/document.ingest" }],
  },
  async ({ event, step }) => {
    const { documentId, userId } = event.data;

    await step.run("ingest-document-pipeline", async () => {
      log.info("Starting durable ingestion for document {documentId}", {
        documentId,
        userId,
      });

      try {
        await ingestDocument(documentId, userId);
      } catch (err) {
        const appErr = toAppError(err);
        if (
          appErr.code === ERROR_CODE.NOT_FOUND ||
          appErr.code === ERROR_CODE.RAG_EXTRACTION_EMPTY ||
          appErr.code === ERROR_CODE.PROVIDER_NOT_CONFIGURED ||
          appErr.code === ERROR_CODE.INVALID_API_KEY
        ) {
          throw new NonRetriableError(appErr.message, { cause: err });
        }
        throw err;
      }

      log.info("Completed durable ingestion for document {documentId}", {
        documentId,
        userId,
      });
    });

    return { success: true, documentId };
  },
);
