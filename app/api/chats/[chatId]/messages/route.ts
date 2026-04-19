import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { chatId } = await params;

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  const { id, role, content, parentId } = await req.json();

  const [newMessage] = await db
    .insert(message)
    .values({ id, chatId, role, content, parentId: parentId ?? null })
    .returning();

  return Response.json(newMessage, { status: 201 });
}
