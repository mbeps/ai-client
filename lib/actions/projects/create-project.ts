"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schema";
import type { ProjectRow } from "@/types/project-row";

export async function createProject(data: {
  name: string;
  description?: string;
}): Promise<ProjectRow> {
  const session = await requireSession();

  const [row] = await db
    .insert(project)
    .values({
      name: data.name,
      description: data.description ?? null,
      userId: session.user.id,
    })
    .returning();

  return row;
}
