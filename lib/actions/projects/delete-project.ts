"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project, chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deleteProject(id: string): Promise<void> {
  const session = await requireSession();

  await db
    .update(chat)
    .set({ projectId: null })
    .where(and(eq(chat.projectId, id), eq(chat.userId, session.user.id)));

  await db
    .delete(project)
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)));
}
