"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

export async function listTransformAgents(): Promise<TransformAgentRow[]> {
  const session = await requireSession();
  return db
    .select()
    .from(transformAgent)
    .where(eq(transformAgent.userId, session.user.id))
    .orderBy(desc(transformAgent.updatedAt));
}
