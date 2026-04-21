"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "./types";

export async function togglePinProject(id: string): Promise<ProjectRow> {
  const session = await requireSession();

  const [current] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)));

  if (!current) throw new Error("Not Found");

  const [row] = await db
    .update(project)
    .set({ isPinned: !current.isPinned, updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)))
    .returning();

  return row;
}
