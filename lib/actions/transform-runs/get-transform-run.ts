"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

export async function getTransformRun(
  id: string,
): Promise<TransformRunRow | null> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(transformRun)
    .where(
      and(eq(transformRun.id, id), eq(transformRun.userId, session.user.id)),
    )
    .limit(1);
  return rows[0] ?? null;
}
