"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

export async function deleteModel(
  modelIdOrIds: string | string[],
): Promise<void> {
  const session = await requireSession();
  const ids = Array.isArray(modelIdOrIds) ? modelIdOrIds : [modelIdOrIds];

  if (ids.length === 0) return;

  const deleted = await db
    .delete(aiModel)
    .where(and(inArray(aiModel.id, ids), eq(aiModel.userId, session.user.id)))
    .returning({ id: aiModel.id });

  logger.info(
    "Models deleted successfully",
    { count: deleted.length, ids, userId: session.user.id },
    session.user.id,
  );

  if (deleted.length === 0) {
    throw new Error("Not Found");
  }
}
