"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    globalPrompt?: string;
  },
): Promise<ProjectRow> {
  const session = await requireSession();

  const [row] = await db
    .update(project)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
