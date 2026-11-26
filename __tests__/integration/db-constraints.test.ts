import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schemas/auth-schema";
import { chat, message } from "@/drizzle/schemas/chat-schema";

class RollbackSignal extends Error {}

describe("Postgres + Drizzle integration", () => {
  it("enforces chat -> chatMessage FK cascade inside a rolled-back transaction", async () => {
    const userId = `int-user-${Date.now()}`;
    const chatId = `00000000-0000-4000-8000-${String(Date.now()).slice(-12)}`;
    const msgId = `00000000-0000-4000-8001-${String(Date.now()).slice(-12)}`;

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: "Integration User",
          email: `${userId}@example.com`,
          emailVerified: true,
        });

        await tx.insert(chat).values({
          id: chatId,
          userId,
          title: "Integration Chat",
        });

        await tx.insert(message).values({
          id: msgId,
          chatId,
          role: "user",
          content: "hello",
        });

        await tx.delete(chat).where(eq(chat.id, chatId));

        const remaining = await tx
          .select({ id: message.id })
          .from(message)
          .where(eq(message.id, msgId));

        expect(remaining).toEqual([]);
        throw new RollbackSignal("rollback");
      }),
    ).rejects.toThrow(RollbackSignal);
  });
});
