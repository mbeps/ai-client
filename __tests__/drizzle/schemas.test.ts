import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { kbChunk } from "@/drizzle/schemas/kb-chunk-schema";

describe("chat-schema", () => {
  it("message table has updatedAt with onUpdate", () => {
    const cols = getTableColumns(message);
    expect(cols.updatedAt).toBeDefined();
    expect(cols.updatedAt.name).toBe("updated_at");
    expect(cols.updatedAt.onUpdateFn).toBeDefined();
  });

  it("chat table updatedAt also has onUpdate (house style reference)", () => {
    expect(getTableColumns(chat).updatedAt.onUpdateFn).toBeDefined();
  });
});

describe("transform-agent-schema", () => {
  it.each([transformAgent, transformRun])(
    "%o updatedAt uses DB defaultNow + onUpdate",
    (table) => {
      const col = getTableColumns(table).updatedAt;
      expect(col.hasDefault).toBe(true);
      expect(col.defaultFn).toBeUndefined();
      expect(col.onUpdateFn).toBeDefined();
    },
  );
});

describe("kb-chunk-schema", () => {
  it("embedding dataType is dimensioned vector", () => {
    const col = getTableColumns(kbChunk).embedding;
    expect(col.getSQLType()).toMatch(/^vector\(\d+\)$/);
  });
});
