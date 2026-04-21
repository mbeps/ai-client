"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";

export async function renameProject(
  projectId: string,
  name: string,
): Promise<ProjectRow> {
  const session = await requireSession();

  const [updated] = await db
    .update(project)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(project.id, projectId), eq(project.userId, session.user.id)))
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}
