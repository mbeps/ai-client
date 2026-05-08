"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { uploadObject } from "@/lib/storage/s3-client";
import { randomUUID } from "crypto";

export async function uploadRunInput(
  formData: FormData,
): Promise<{ id: string; name: string }[]> {
  const session = await requireSession();
  const files = formData.getAll("files") as File[];
  const results: { id: string; name: string }[] = [];

  for (const file of files) {
    const id = randomUUID();
    const key = `transform-inputs/${session.user.id}/${id}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadObject(key, buffer, file.type || "application/octet-stream");

    const [row] = await db
      .insert(attachment)
      .values({
        id,
        messageId: null,
        transformRunId: null,
        userId: session.user.id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        key,
      })
      .returning();

    results.push({ id: row.id, name: row.name });
  }

  return results;
}
