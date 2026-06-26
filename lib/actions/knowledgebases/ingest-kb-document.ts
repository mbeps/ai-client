"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";
import { ingestDocument } from "@/lib/rag/ingest";
import {
  RagExtractionEmptyError,
  ProviderNotConfiguredError,
} from "@/lib/constants/errors";

const ingestKbDocumentSchema = z.object({
  documentId: z.string().uuid("Invalid document ID format"),
});

export type IngestKbDocumentResult = {
  success: boolean;
  error?: string;
  code?: string;
};

/**
 * Next.js Server Action to trigger the ingestion process (extraction, chunking, embedding) for a document.
 * Follows the Result Object Pattern to safely handle errors in the frontend.
 */
export async function ingestKbDocument(
  documentId: string,
): Promise<IngestKbDocumentResult> {
  try {
    const session = await requireSession();

    // 1. Validate Input
    const validation = ingestKbDocumentSchema.safeParse({ documentId });
    if (!validation.success) {
      return { success: false, error: "Invalid document ID format" };
    }
    const validatedId = validation.data.documentId;

    // 2. Validate Ownership
    const [doc] = await db
      .select({ id: kbDocument.id })
      .from(kbDocument)
      .where(
        and(
          eq(kbDocument.id, validatedId),
          eq(kbDocument.userId, session.user.id),
        ),
      );

    if (!doc) {
      return { success: false, error: "Document not found or access denied" };
    }

    // 3. Execution
    await ingestDocument(validatedId, session.user.id);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data" };
    }

    if (
      error instanceof RagExtractionEmptyError ||
      error instanceof ProviderNotConfiguredError
    ) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    logger.error("[ingestKbDocument] Unexpected error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during ingestion",
    };
  }
}
