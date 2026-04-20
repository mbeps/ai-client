import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { attachment, message, chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { uploadObject, ensureBucket } from "@/lib/storage/s3-client";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const messageId = formData.get("messageId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!messageId) {
    return NextResponse.json(
      { error: "No messageId provided" },
      { status: 400 },
    );
  }

  const [messageOwner] = await db
    .select({ chatUserId: chat.userId })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(eq(message.id, messageId));

  if (!messageOwner || messageOwner.chatUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mimeType =
    file.type ||
    (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "");

  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `File type "${mimeType || "unknown"}" is not supported.` },
      { status: 400 },
    );
  }

  const isImage = mimeType.startsWith("image/");
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File exceeds the ${isImage ? "2 MB" : "20 MB"} size limit.` },
      { status: 400 },
    );
  }

  await ensureBucket();

  const id = crypto.randomUUID();
  const key = `attachments/${session.user.id}/${id}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadObject(key, buffer, mimeType);

  const [row] = await db
    .insert(attachment)
    .values({
      id,
      messageId,
      userId: session.user.id,
      name: file.name,
      mimeType,
      size: file.size,
      key,
    })
    .returning();

  return NextResponse.json(row);
}
