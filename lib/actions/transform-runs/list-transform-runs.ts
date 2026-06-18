"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

export async function listTransformRuns(
  agentId: string,
): Promise<TransformRunRow[]> {
  const session = await requireSession();
  return db
    .select()
    .from(transformRun)
    .where(
      and(
        eq(transformRun.agentId, agentId),
        eq(transformRun.userId, session.user.id),
      ),
    )
    .orderBy(desc(transformRun.createdAt));
}
