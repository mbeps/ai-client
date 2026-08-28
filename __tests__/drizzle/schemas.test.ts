import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { kbChunk } from "@/drizzle/schemas/kb-chunk-schema";
import { skill } from "@/drizzle/schemas/skill-schema";

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

describe("attachment.transformRunId FK (A-H5)", () => {
  it("references transform_run with onDelete set null and is indexed", () => {
    const { foreignKeys, indexes } = getTableConfig(attachment);
    const fk = foreignKeys.find(
      (f) =>
        getTableName(f.reference().foreignColumns[0].table) === "transform_run",
    );
    expect(fk).toBeDefined();
    const ref = fk!.reference();
    expect(ref.columns[0].name).toBe("transform_run_id");
    expect(ref.foreignColumns[0].name).toBe("id");
    expect(fk!.onDelete).toBe("set null");
    expect(
      indexes.some((i) =>
        i.config.columns.some(
          (c) => "name" in c && c.name === "transform_run_id",
        ),
      ),
    ).toBe(true);
  });
});

describe("kb-chunk-schema", () => {
  it("embedding dataType is unconstrained vector", () => {
    const col = getTableColumns(kbChunk).embedding;
    expect(col.getSQLType()).toBe("vector");
  });
});

describe("skill-schema", () => {
  it("defines skill table with proper columns", () => {
    const cols = getTableColumns(skill);
    expect(cols.id).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.displayName).toBeDefined();
    expect(cols.description).toBeDefined();
    expect(cols.content).toBeDefined();
    expect(cols.files).toBeDefined();
    expect(cols.enabled).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });
});
