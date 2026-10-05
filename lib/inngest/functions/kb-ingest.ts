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
    retries: 2,
    triggers: [{ event: "knowledgebase/document.ingest" }],
  },
  async ({ event, step }) => {
    const { documentId, userId } = event.data;

    await step.run("ingest-document-pipeline", async () => {
      log.info("Starting durable ingestion for document {documentId}", {
        documentId,
        userId,
      });

      await ingestDocument(documentId, userId);

      log.info("Completed durable ingestion for document {documentId}", {
        documentId,
        userId,
      });
    });

    return { success: true, documentId };
  },
);
