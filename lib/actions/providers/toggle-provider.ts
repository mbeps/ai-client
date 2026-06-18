"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

export async function toggleProvider(
  providerId: string,
  enabled: boolean,
): Promise<void> {
  const session = await requireSession();

  const [updated] = await db
    .update(aiProvider)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    )
    .returning({ id: aiProvider.id });

  if (!updated) {
    throw new Error("Not Found");
  }
}
