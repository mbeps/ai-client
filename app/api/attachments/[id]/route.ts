import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/storage/s3-client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select()
    .from(attachment)
    .where(and(eq(attachment.id, id), eq(attachment.userId, session.user.id)));

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getPresignedUrl(row.key);
  return NextResponse.json({ url, name: row.name, mimeType: row.mimeType });
}
