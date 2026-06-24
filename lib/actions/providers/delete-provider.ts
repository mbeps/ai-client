"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

export async function deleteProvider(providerId: string): Promise<void> {
  const session = await requireSession();

  const [deleted] = await db
    .delete(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    )
    .returning({ id: aiProvider.id });

  if (!deleted) {
    throw new Error("Not Found");
  }
}
