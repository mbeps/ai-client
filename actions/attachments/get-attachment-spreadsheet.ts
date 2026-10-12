"use server";

import { and, eq } from "drizzle-orm";
import * as xlsx from "xlsx";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { downloadObject } from "@/lib/storage/download-object";
import type { ArtifactSheet } from "@/types/artifact/artifact-sheet";

export interface AttachmentSpreadsheetResult {
  id: string;
  name: string;
  sheets: ArtifactSheet[];
}

/**
 * Downloads a spreadsheet attachment from S3 on the server and parses its sheets.
 * Used by preview components (such as transform run inspection) to avoid client-side
 * CORS or S3 presigned URL networking issues.
 *
 * @param id - UUID of the attachment to retrieve; must be owned by the authenticated user.
 * @returns Object containing the attachment ID, filename, and parsed sheets array.
 * @throws Error if session is not authenticated or attachment is not found.
 * @author Maruf Bepary
 */
export async function getAttachmentSpreadsheet(
  id: string,
): Promise<AttachmentSpreadsheetResult> {
  const session = await requireSession();

  const validatedId = z.string().uuid().parse(id);

  const [row] = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, validatedId),
        eq(attachment.userId, session.user.id),
      ),
    );

  if (!row) {
    throw new Error("Not Found");
  }

  const buffer = await downloadObject(row.key);
  const wb = xlsx.read(buffer, { type: "buffer" });

  const sheets: ArtifactSheet[] = wb.SheetNames.map((name) => {
    const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
    }) as any[][];
    // Cap at 500 rows for preview performance
    const data = rawData.slice(0, 500);
    return { name, data };
  });

  return {
    id: row.id,
    name: row.name,
    sheets,
  };
}

