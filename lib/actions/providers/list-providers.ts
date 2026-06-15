"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import type { AiProviderRow } from "@/types/ai-provider-row";

export async function listProviders(): Promise<AiProviderRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(aiProvider)
    .where(eq(aiProvider.userId, session.user.id))
    .orderBy(desc(aiProvider.updatedAt));
}
