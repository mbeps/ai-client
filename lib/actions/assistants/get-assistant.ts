"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "./types";

export async function getAssistant(id: string): Promise<AssistantRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(assistant)
    .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
