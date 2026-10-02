import { beforeEach, describe, expect, it, vi } from "vitest";
import { SKILL_BUNDLE_MAX_BYTES } from "@/config/skills";

// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
  env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "where",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
    "returning",
    "orderBy",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

import {
  createSkillForUser,
  deleteSkillForUser,
  getSkillForUser,
  listSkillsForUser,
  updateSkillForUser,
} from "@/lib/skills/skill-service";
import {
  deleteSkillFileForUser,
  listSkillFilesForUser,
  readSkillFileForUser,
  writeSkillFileForUser,
} from "@/lib/skills/skill-file-service";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  name: "clean-code",
  displayName: "Clean Code",
  description: "Write clean code",
  content: "Use descriptive names.",
  files: [] as { path: string; content: string }[],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * The ownership probe and the duplicate-slug probe both terminate on `limit`.
 * A per-test queue lets a test say "the row exists" for the first call and
 * "no other row holds this name" for the second, which is what production does.
 */
const limitQueue = vi.hoisted(() => ({ rows: [] as unknown[][] }));

beforeEach(() => {
  for (const fn of Object.values(chainable)) fn.mockClear();
  limitQueue.rows = [];
  chainable.limit.mockImplementation(() => {
    const next = limitQueue.rows.shift();
    return Promise.resolve(next ?? [row]);
  });
  chainable.returning.mockResolvedValue([row]);
  chainable.orderBy.mockResolvedValue([row]);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockReturnValue(chainable);
});

describe("getSkillForUser", () => {
  it("resolves by name for the owning user", async () => {
    expect((await getSkillForUser("user-1", "clean-code"))?.id).toBe(row.id);
  });

  it("resolves by uuid for the owning user", async () => {
    expect((await getSkillForUser("user-1", row.id))?.id).toBe(row.id);
  });

  it("returns null when the row is not visible to this user", async () => {
    limitQueue.rows = [[]];
    expect(await getSkillForUser("user-2", row.id)).toBeNull();
  });
});

describe("listSkillsForUser", () => {
  it("returns the rows for the user", async () => {
    expect(await listSkillsForUser("user-1")).toHaveLength(1);
  });
});

describe("createSkillForUser", () => {
  it("inserts with the supplied userId and returns the row", async () => {
    // create makes exactly one probe: the duplicate-slug check.
    limitQueue.rows = [[]];
    const created = await createSkillForUser("user-1", {
      name: "new-skill",
      displayName: "Clean Code",
      description: "d",
      content: "c",
    });
    expect(chainable.insert).toHaveBeenCalledWith(expect.anything());
    expect(created.id).toBe(row.id);
  });

  it("refuses a duplicate slug with the existing message", async () => {
    limitQueue.rows = [[{ id: "other" }]];
    await expect(
      createSkillForUser("user-1", {
        name: "clean-code",
        displayName: "Clean Code",
        description: "d",
        content: "c",
      }),
    ).rejects.toThrow('A skill with name "clean-code" already exists.');
  });
});

describe("updateSkillForUser", () => {
  it("returns null when nothing was updated", async () => {
    chainable.returning.mockResolvedValue([]);
    expect(
      await updateSkillForUser("user-1", "clean-code", { content: "x" }),
    ).toBeNull();
  });

  it("returns null when the skill is not visible to the user", async () => {
    limitQueue.rows = [[]];
    expect(
      await updateSkillForUser("user-1", "clean-code", { content: "x" }),
    ).toBeNull();
  });

  it("refuses a slug that another skill already holds", async () => {
    limitQueue.rows = [[row], [{ id: "other" }]];
    await expect(
      updateSkillForUser("user-1", "clean-code", { name: "other-name" }),
    ).rejects.toThrow('A skill with name "other-name" already exists.');
  });

  it("updates the body when content is supplied", async () => {
    const updated = await updateSkillForUser("user-1", "clean-code", {
      content: "New body",
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ content: "New body" }),
    );
    expect(updated?.id).toBe(row.id);
  });

  it("applies a slug rename after the uniqueness probe passes", async () => {
    limitQueue.rows = [[row], []];
    await updateSkillForUser("user-1", "clean-code", { name: "cleaner-code" });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cleaner-code" }),
    );
  });

  it("updates the display name when supplied", async () => {
    await updateSkillForUser("user-1", "clean-code", {
      displayName: "Renamed",
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Renamed" }),
    );
  });

  it("updates the description when supplied", async () => {
    await updateSkillForUser("user-1", "clean-code", {
      description: "New description",
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ description: "New description" }),
    );
  });

  it("omits the body from the update when content is not supplied", async () => {
    await updateSkillForUser("user-1", "clean-code", { description: "d" });
    const setArg = chainable.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(setArg)).not.toContain("content");
  });

  it("updates the enabled flag when supplied", async () => {
    await updateSkillForUser("user-1", "clean-code", { enabled: false });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("updates the bundled files when supplied", async () => {
    await updateSkillForUser("user-1", "clean-code", {
      files: [{ path: "a.md", content: "A" }],
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ files: [{ path: "a.md", content: "A" }] }),
    );
  });
});

describe("deleteSkillForUser", () => {
  it("reports the number of deleted rows", async () => {
    expect(await deleteSkillForUser("user-1", "clean-code")).toEqual({
      deletedCount: 1,
    });
  });

  it("deletes nothing when the skill is not visible to the user", async () => {
    limitQueue.rows = [[]];
    expect(await deleteSkillForUser("user-1", "clean-code")).toEqual({
      deletedCount: 0,
    });
  });
});

describe("writeSkillFileForUser", () => {
  it("routes SKILL.md to the body column", async () => {
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "SKILL.md",
      "New body",
    );
    expect(result).toMatchObject({ path: "SKILL.md", target: "skill-md" });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ content: "New body" }),
    );
  });

  it("routes a reference path to the bundled files", async () => {
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "references/guide.md",
      "Body",
    );
    expect(result).toMatchObject({
      path: "references/guide.md",
      target: "bundled",
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [{ path: "references/guide.md", content: "Body" }],
      }),
    );
  });

  it("reports whether the path was created or updated", async () => {
    const created = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "a.md",
      "x",
    );
    expect(created).toMatchObject({ action: "created" });

    limitQueue.rows = [[{ ...row, files: [{ path: "a.md", content: "old" }] }]];
    const updated = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "a.md",
      "x",
    );
    expect(updated).toMatchObject({ action: "updated" });
  });

  it("refuses a traversal path and writes nothing", async () => {
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "../../.env",
      "x",
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("refuses a case-only duplicate reference path", async () => {
    limitQueue.rows = [
      [{ ...row, files: [{ path: "references/Guide.md", content: "old" }] }],
    ];
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "references/guide.md",
      "new",
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("refuses a bundle that is over budget and writes nothing", async () => {
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "references/big.md",
      "x".repeat(SKILL_BUNDLE_MAX_BYTES),
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("refuses an oversized body and writes nothing", async () => {
    const result = await writeSkillFileForUser(
      "user-1",
      "clean-code",
      "SKILL.md",
      "x".repeat(300000),
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("returns an error when the skill is not found", async () => {
    limitQueue.rows = [[]];
    expect(await writeSkillFileForUser("user-1", "missing", "a.md", "x")).toEqual(
      { error: expect.any(String) },
    );
  });
});

describe("readSkillFileForUser", () => {
  it("returns the body for SKILL.md", async () => {
    expect(
      await readSkillFileForUser("user-1", "clean-code", "SKILL.md"),
    ).toMatchObject({ target: "skill-md", content: "Use descriptive names." });
  });

  it("returns a bundled file by path", async () => {
    limitQueue.rows = [[{ ...row, files: [{ path: "a.md", content: "A" }] }]];
    expect(await readSkillFileForUser("user-1", "clean-code", "a.md")).toMatchObject(
      { content: "A", target: "bundled" },
    );
  });

  it("returns null for a path that does not exist", async () => {
    expect(
      await readSkillFileForUser("user-1", "clean-code", "missing.md"),
    ).toBeNull();
  });

  it("returns null for an invalid path without touching the database", async () => {
    expect(
      await readSkillFileForUser("user-1", "clean-code", "../escape.md"),
    ).toBeNull();
  });

  it("returns null when the skill is not found", async () => {
    limitQueue.rows = [[]];
    expect(await readSkillFileForUser("user-1", "missing", "a.md")).toBeNull();
  });
});

describe("listSkillFilesForUser", () => {
  it("returns a manifest of paths and byte counts", async () => {
    limitQueue.rows = [[{ ...row, files: [{ path: "a.md", content: "AAA" }] }]];
    expect(await listSkillFilesForUser("user-1", "clean-code")).toEqual({
      manifest: [
        { path: "SKILL.md", bytes: "Use descriptive names.".length },
        { path: "a.md", bytes: 3 },
      ],
    });
  });

  it("includes the body as the first manifest entry", async () => {
    const result = await listSkillFilesForUser("user-1", "clean-code");
    expect(result?.manifest[0]).toEqual({
      path: "SKILL.md",
      bytes: "Use descriptive names.".length,
    });
  });

  it("returns null when the skill is not found", async () => {
    limitQueue.rows = [[]];
    expect(await listSkillFilesForUser("user-1", "missing")).toBeNull();
  });
});

describe("deleteSkillFileForUser", () => {
  it("refuses to delete SKILL.md", async () => {
    expect(
      await deleteSkillFileForUser("user-1", "clean-code", "SKILL.md"),
    ).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("removes a bundled file and returns the new path", async () => {
    limitQueue.rows = [[{ ...row, files: [{ path: "a.md", content: "A" }] }]];
    expect(
      await deleteSkillFileForUser("user-1", "clean-code", "a.md"),
    ).toMatchObject({ path: "a.md" });
  });

  it("returns an error when the bundled file does not exist", async () => {
    expect(
      await deleteSkillFileForUser("user-1", "clean-code", "missing.md"),
    ).toEqual({ error: expect.any(String) });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("returns an error when the skill is not found", async () => {
    limitQueue.rows = [[]];
    expect(
      await deleteSkillFileForUser("user-1", "missing", "a.md"),
    ).toEqual({ error: expect.any(String) });
  });

  it("refuses an invalid path without touching the database", async () => {
    expect(
      await deleteSkillFileForUser("user-1", "clean-code", "../escape.md"),
    ).toEqual({ error: expect.any(String) });
  });
});
