"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { deleteDocumentSchema } from "@/schemas/knowledgebase/knowledgebase";
import { z } from "zod";

export async function deleteDocument(
  data: z.infer<typeof deleteDocumentSchema>,
): Promise<void> {
  const session = await requireSession();

  const validated = deleteDocumentSchema.parse(data);

  const [doc] = await db
    .select()
    .from(kbDocument)
    .where(
      and(
        eq(kbDocument.id, validated.documentId),
        eq(kbDocument.userId, session.user.id),
      ),
    );

  if (!doc) throw new Error("Document not found");

  await s3Client.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
  );

  await db.delete(kbDocument).where(eq(kbDocument.id, validated.documentId));
}
