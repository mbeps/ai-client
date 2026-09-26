// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const mockParser = vi.hoisted(() => ({
  createSkillZip: vi.fn().mockReturnValue(Buffer.from("fake-zip-binary")),
  extractSkillFromZip: vi.fn().mockReturnValue({
    name: "zip-skill",
    displayName: "Zip Skill",
    description: "Extracted from zip",
    content: "# Zip Skill",
    files: [],
  }),
  parseSkillMarkdown: vi.fn().mockReturnValue({
    name: "md-skill",
    displayName: "MD Skill",
    description: "Extracted from MD",
    content: "# MD Skill",
    files: [],
  }),
  sanitizeSkillSlug: vi.fn((slug: string) => slug),
}));

vi.mock("@/lib/skills/parser", () => mockParser);

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSkill } from "@/actions/skills/create-skill";
import { deleteSkill } from "@/actions/skills/delete-skill";
import { exportSkillZip } from "@/actions/skills/export-skill";
import { getSkill } from "@/actions/skills/get-skill";
import { importSkillFile } from "@/actions/skills/import-skill";
import { listSkills } from "@/actions/skills/list-skills";
import { toggleSkillEnabled } from "@/actions/skills/toggle-skill";
import { updateSkill } from "@/actions/skills/update-skill";

const SKILL_ID = "11111111-1111-4111-8111-111111111111";

const SAMPLE_SKILL = {
  id: SKILL_ID,
  userId: "user-1",
  name: "test-skill",
  displayName: "Test Skill",
  description: "A test skill",
  content: "# Instructions",
  files: [],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Agent Skill Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.limit.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.orderBy.mockReturnValue(chainable);
  });

  describe("createSkill", () => {
    it("creates a skill when name is unique", async () => {
      // Slug uniqueness check: not found
      chainable.limit.mockResolvedValueOnce([]);
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await createSkill({
        name: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        content: "# Instructions",
        files: [],
        enabled: true,
      });

      expect(result).toEqual(SAMPLE_SKILL);
      expect(chainable.insert).toHaveBeenCalled();
    });

    it("throws error when skill name already exists", async () => {
      chainable.limit.mockResolvedValueOnce([{ id: "other-skill" }]);

      await expect(
        createSkill({
          name: "test-skill",
          displayName: "Test Skill",
          description: "A test skill",
          content: "# Instructions",
        }),
      ).rejects.toThrow('A skill with name "test-skill" already exists.');
    });
  });

  describe("getSkill", () => {
    it("returns skill row when found", async () => {
      chainable.limit.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await getSkill(SKILL_ID);
      expect(result).toEqual(SAMPLE_SKILL);
    });

    it("throws 'Not Found' when skill does not exist", async () => {
      chainable.limit.mockResolvedValueOnce([]);

      await expect(getSkill(SKILL_ID)).rejects.toThrow("Not Found");
    });
  });

  describe("listSkills", () => {
    it("returns all user skills ordered by updatedAt DESC", async () => {
      chainable.orderBy.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await listSkills();
      expect(result).toEqual([SAMPLE_SKILL]);
    });
  });

  describe("toggleSkillEnabled", () => {
    it("toggles enabled status and returns updated skill", async () => {
      const updated = { ...SAMPLE_SKILL, enabled: false };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await toggleSkillEnabled(SKILL_ID, false);
      expect(result).toEqual(updated);
      expect(chainable.update).toHaveBeenCalled();
    });

    it("throws 'Not Found' when skill does not exist", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(toggleSkillEnabled(SKILL_ID, false)).rejects.toThrow(
        "Not Found",
      );
    });
  });

  describe("updateSkill", () => {
    it("updates all fields when provided and name is unique", async () => {
      // Check existing skill with same name: none found
      chainable.limit.mockResolvedValueOnce([]);
      const updated = {
        ...SAMPLE_SKILL,
        name: "new-name",
        displayName: "New Name",
        description: "New Desc",
        content: "New content",
        files: [{ path: "sub.md", content: "hi" }],
        enabled: false,
      };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateSkill(SKILL_ID, {
        name: "new-name",
        displayName: "New Name",
        description: "New Desc",
        content: "New content",
        files: [{ path: "sub.md", content: "hi" }],
        enabled: false,
      });

      expect(result).toEqual(updated);
    });

    it("throws error when updated name collides with another skill", async () => {
      chainable.limit.mockResolvedValueOnce([{ id: "another-id" }]);

      await expect(
        updateSkill(SKILL_ID, { name: "colliding-name" }),
      ).rejects.toThrow('A skill with name "colliding-name" already exists.');
    });

    it("updates without name check when name is omitted", async () => {
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await updateSkill(SKILL_ID, {
        displayName: "Only Display Name",
        content: "Only Content",
        enabled: true,
      });

      expect(result).toEqual(SAMPLE_SKILL);
      expect(chainable.limit).not.toHaveBeenCalled();
    });

    it("updates even fields (name, description, files) while omitting odd fields", async () => {
      chainable.limit.mockResolvedValueOnce([]);
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await updateSkill(SKILL_ID, {
        name: "only-name",
        description: "Only Desc",
        files: [],
      });

      expect(result).toEqual(SAMPLE_SKILL);
    });

    it("throws 'Not Found' when updated row is not found", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(
        updateSkill(SKILL_ID, { displayName: "No Row" }),
      ).rejects.toThrow("Not Found");
    });
  });

  describe("deleteSkill", () => {
    it("deletes skill using entity factory", async () => {
      chainable.where.mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([{ id: SKILL_ID }]),
      });

      const result = await deleteSkill(SKILL_ID);
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe("exportSkillZip", () => {
    it("exports base64 zip successfully", async () => {
      chainable.limit.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await exportSkillZip(SKILL_ID);
      expect(result).toEqual({
        filename: "test-skill.zip",
        base64: Buffer.from("fake-zip-binary").toString("base64"),
      });
      expect(mockParser.createSkillZip).toHaveBeenCalled();
    });

    it("handles null/falsy files array fallback in export", async () => {
      chainable.limit.mockResolvedValueOnce([{ ...SAMPLE_SKILL, files: null }]);

      const result = await exportSkillZip(SKILL_ID);
      expect(result.filename).toBe("test-skill.zip");
    });

    it("propagates Not Found error when skill does not exist", async () => {
      chainable.limit.mockResolvedValueOnce([]);

      await expect(exportSkillZip(SKILL_ID)).rejects.toThrow("Not Found");
    });
  });

  describe("importSkillFile", () => {
    it("throws if no file is uploaded", async () => {
      const fd = new FormData();
      await expect(importSkillFile(fd)).rejects.toThrow("No file uploaded");
    });

    it("throws for unsupported file extensions", async () => {
      const fd = new FormData();
      fd.append(
        "file",
        new File([new Uint8Array(5)], "image.png", { type: "image/png" }),
      );
      await expect(importSkillFile(fd)).rejects.toThrow(
        "Unsupported file format. Please upload a .md or .zip file.",
      );
    });

    it("imports .zip file and appends suffix if slug already exists", async () => {
      const fd = new FormData();
      fd.append(
        "file",
        new File([new Uint8Array(10)], "my-skill.zip", {
          type: "application/zip",
        }),
      );

      // Slug conflict check: existing found
      chainable.limit.mockResolvedValueOnce([{ id: "existing-id" }]);
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await importSkillFile(fd);
      expect(result).toEqual(SAMPLE_SKILL);
      expect(mockParser.extractSkillFromZip).toHaveBeenCalled();
    });

    it("imports .md file without conflict", async () => {
      const fd = new FormData();
      fd.append(
        "file",
        new File(["# My Skill Content"], "skill.md", { type: "text/markdown" }),
      );

      // Slug conflict check: none found
      chainable.limit.mockResolvedValueOnce([]);
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await importSkillFile(fd);
      expect(result).toEqual(SAMPLE_SKILL);
      expect(mockParser.parseSkillMarkdown).toHaveBeenCalled();
    });

    it("imports .txt file and falls back to 'imported-skill' when slug is empty", async () => {
      mockParser.sanitizeSkillSlug.mockReturnValueOnce("");
      const fd = new FormData();
      fd.append(
        "file",
        new File(["# Text Content"], "skill.txt", { type: "text/plain" }),
      );

      chainable.limit.mockResolvedValueOnce([]);
      chainable.returning.mockResolvedValueOnce([SAMPLE_SKILL]);

      const result = await importSkillFile(fd);
      expect(result).toEqual(SAMPLE_SKILL);
    });
  });
});
