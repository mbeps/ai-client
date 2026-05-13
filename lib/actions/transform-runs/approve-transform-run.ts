"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { TransformRunRow } from "@/types/transform-run-row";

export async function approveTransformRun(
  id: string,
): Promise<TransformRunRow> {
  const session = await requireSession();
  const [row] = await db
    .update(transformRun)
    .set({ status: "running" })
    .where(
      and(
        eq(transformRun.id, id),
        eq(transformRun.userId, session.user.id),
        eq(transformRun.status, "awaiting_review"),
      ),
    )
    .returning();
  if (!row) throw new Error("Run not found or not awaiting review");
  return row;
}
