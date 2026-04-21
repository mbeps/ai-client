"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";

export async function listProjects(): Promise<ProjectRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(project)
    .where(eq(project.userId, session.user.id))
    .orderBy(desc(project.isPinned), desc(project.updatedAt));
}
