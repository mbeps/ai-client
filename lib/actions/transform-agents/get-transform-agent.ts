"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

export async function getTransformAgent(
  id: string,
): Promise<TransformAgentRow | null> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(transformAgent)
    .where(
      and(
        eq(transformAgent.id, id),
        eq(transformAgent.userId, session.user.id),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
