import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { chatId } = await params;

  const [chatRow] = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));

  return Response.json({ ...chatRow, messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { chatId } = await params;

  const [deleted] = await db
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!deleted) return new Response("Not Found", { status: 404 });

  return new Response(null, { status: 204 });
}
