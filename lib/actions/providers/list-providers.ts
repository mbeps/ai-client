"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

export async function listProviders(): Promise<AiProviderRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(aiProvider)
    .where(eq(aiProvider.userId, session.user.id))
    .orderBy(asc(aiProvider.name));
}
