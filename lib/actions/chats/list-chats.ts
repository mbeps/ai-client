"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import type { ChatRow } from "./types";

export async function listChats(): Promise<ChatRow[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return db
    .select()
    .from(chat)
    .where(eq(chat.userId, session.user.id))
    .orderBy(desc(chat.updatedAt));
}
