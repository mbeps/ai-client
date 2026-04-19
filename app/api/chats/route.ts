import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const chats = await db
    .select()
    .from(chat)
    .where(eq(chat.userId, session.user.id))
    .orderBy(desc(chat.updatedAt));

  return Response.json(chats);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { title, projectId, assistantId } = await req.json();

  const [newChat] = await db
    .insert(chat)
    .values({
      id: uuidv4(),
      title: title ?? "New Chat",
      userId: session.user.id,
      projectId: projectId ?? null,
      assistantId: assistantId ?? null,
    })
    .returning();

  return Response.json(newChat, { status: 201 });
}
