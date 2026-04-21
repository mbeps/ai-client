"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { ProjectRow } from "@/types/project-row";

export async function getProject(id: string): Promise<ProjectRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
