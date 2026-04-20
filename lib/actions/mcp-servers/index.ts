"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and, desc, not } from "drizzle-orm";
import { headers } from "next/headers";
import {
  createMcpServerSchema,
  updateMcpServerSchema,
  type CreateMcpServer,
  type UpdateMcpServer,
} from "@/schemas/mcp-server";
import type { McpServerRow } from "./types";

export async function listMcpServers(): Promise<McpServerRow[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.userId, session.user.id))
    .orderBy(desc(mcpServer.updatedAt));
}

export async function getMcpServer(id: string): Promise<McpServerRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}

export async function createMcpServer(
  data: CreateMcpServer,
): Promise<McpServerRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const parsed = createMcpServerSchema.parse(data);

  const values =
    parsed.type === "stdio"
      ? {
          name: parsed.name,
          type: parsed.type,
          command: parsed.command,
          args: parsed.args ?? null,
          env: parsed.env ?? null,
          url: null,
          headers: null,
        }
      : {
          name: parsed.name,
          type: parsed.type,
          url: parsed.url,
          headers: parsed.headers ?? null,
          command: null,
          args: null,
          env: null,
        };

  const [created] = await db
    .insert(mcpServer)
    .values({
      ...values,
      userId: session.user.id,
    })
    .returning();

  return created;
}

export async function updateMcpServer(
  id: string,
  data: UpdateMcpServer,
): Promise<McpServerRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const parsed = updateMcpServerSchema.parse(data);

  const values =
    parsed.type === "stdio"
      ? {
          name: parsed.name,
          type: parsed.type,
          command: parsed.command,
          args: parsed.args ?? null,
          env: parsed.env ?? null,
          url: null,
          headers: null,
        }
      : {
          name: parsed.name,
          type: parsed.type,
          url: parsed.url,
          headers: parsed.headers ?? null,
          command: null,
          args: null,
          env: null,
        };

  const [updated] = await db
    .update(mcpServer)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}

export async function deleteMcpServer(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [deleted] = await db
    .delete(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning({ id: mcpServer.id });

  if (!deleted) throw new Error("Not Found");
}

export async function toggleMcpServer(id: string): Promise<McpServerRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [toggled] = await db
    .update(mcpServer)
    .set({ enabled: not(mcpServer.enabled), updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!toggled) throw new Error("Not Found");

  return toggled;
}

export async function renameMcpServer(
  id: string,
  name: string,
): Promise<McpServerRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [renamed] = await db
    .update(mcpServer)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!renamed) throw new Error("Not Found");

  return renamed;
}
