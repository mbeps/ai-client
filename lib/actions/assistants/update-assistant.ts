"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "./types";

export async function updateAssistant(
  id: string,
  data: {
    name?: string;
    description?: string;
    prompt?: string;
    avatar?: string;
  },
): Promise<AssistantRow> {
  const session = await requireSession();

  const [row] = await db
    .update(assistant)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
