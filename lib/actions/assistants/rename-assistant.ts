"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "./types";

export async function renameAssistant(
  assistantId: string,
  name: string,
): Promise<AssistantRow> {
  const session = await requireSession();

  const [updated] = await db
    .update(assistant)
    .set({ name, updatedAt: new Date() })
    .where(
      and(eq(assistant.id, assistantId), eq(assistant.userId, session.user.id)),
    )
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}
