import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ingestDocument } from "@/lib/rag/ingest";
import {
  RagExtractionEmptyError,
  RAG_EXTRACTION_EMPTY_ERROR_CODE,
  ProviderNotConfiguredError,
  PROVIDER_NOT_CONFIGURED_ERROR_CODE,
} from "@/lib/constants/errors";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  const [doc] = await db
    .select({ id: kbDocument.id })
    .from(kbDocument)
    .where(
      and(
        eq(kbDocument.id, documentId),
        eq(kbDocument.userId, session.user.id),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await ingestDocument(documentId, session.user.id);
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      return Response.json(
        { error: err.message, code: PROVIDER_NOT_CONFIGURED_ERROR_CODE },
        { status: 400 },
      );
    }

    // Handle RAG extraction empty error specifically
    if (err instanceof RagExtractionEmptyError) {
      const documentName = (err as any).documentName || "document";
      return Response.json(
        {
          error: `Document "${documentName}" contains no readable text.`,
          code: RAG_EXTRACTION_EMPTY_ERROR_CODE,
        },
        { status: 422 },
      );
    }
    return Response.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
