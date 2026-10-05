import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument, knowledgebase } from "@/drizzle/schema";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";

const log = getLogger(["inngest", "kb", "reindex"]);

/**
 * Inngest durable function re-indexing an entire knowledge base.
 * Dispatches parallel ingestion jobs for all documents and manages indexStatus.
 *
 * @author Maruf Bepary
 */
export const reindexKbFunction = inngest.createFunction(
  {
    id: "reindex-knowledgebase",
    retries: 1,
    triggers: [{ event: "knowledgebase/reindex" }],
  },
  async ({ event, step }) => {
    const { kbId, userId } = event.data;

    // 1. Fetch KB and set status to indexing
    const docs = await step.run("mark-indexing-and-fetch-docs", async () => {
      const [kb] = await db
        .select()
        .from(knowledgebase)
        .where(
          and(eq(knowledgebase.id, kbId), eq(knowledgebase.userId, userId)),
        );

      if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

      await db
        .update(knowledgebase)
        .set({
          indexStatus: "indexing",
          lastIndexedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgebase.id, kbId));

      await db
        .update(kbDocument)
        .set({ statusMessage: null })
        .where(eq(kbDocument.kbId, kbId));

      const documentRows = await db
        .select({ id: kbDocument.id })
        .from(kbDocument)
        .where(eq(kbDocument.kbId, kbId));

      return documentRows;
    });

    if (docs.length === 0) {
      await step.run("mark-ready-empty", async () => {
        await db
          .update(knowledgebase)
          .set({ indexStatus: "ready", updatedAt: new Date() })
          .where(eq(knowledgebase.id, kbId));
      });
      return { count: 0 };
    }

    // 2. Fan-out ingestion events for all documents
    await step.run("fan-out-doc-ingest", async () => {
      const events = docs.map((doc) => ({
        name: "knowledgebase/document.ingest" as const,
        data: { documentId: doc.id, userId },
      }));

      await inngest.send(events);
    });

    log.info("Dispatched {count} document ingestion jobs for KB {kbId}", {
      count: docs.length,
      kbId,
      userId,
    });

    return { dispatched: docs.length };
  },
);
