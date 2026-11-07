import { describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { skill } from "@/drizzle/schemas/skill-schema";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

describe("registerSkillTool", () => {
  it("registers load_skill tool and executes successfully when skill is found", async () => {
    const tools = registerSkillTool("user-1");
    expect(tools.load_skill).toBeDefined();

    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          name: "clean-code",
          displayName: "Clean Code",
          description: "Write clean code",
          content: "Use descriptive names.",
          files: [{ path: "rules.md", content: "Rule 1" }],
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "Clean-Code",
    });

    expect(result).toMatchObject({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Write clean code",
    });
    expect(result.instructions).toContain("Use descriptive names.");
    expect(result.instructions).toContain("Bundled Reference Files:");
    expect(result.instructions).toContain("rules.md");
  });

  it("handles skill with null files property without error", async () => {
    const tools = registerSkillTool("user-1");
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          name: "clean-code-no-files",
          displayName: "Clean Code",
          description: "Write clean code",
          content: "Use descriptive names.",
          files: null,
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "clean-code-no-files",
    });

    expect(result.instructions).toBe("Use descriptive names.");
    expect(result.instructions).not.toContain("Bundled Reference Files:");
  });

  it("returns error object when skill is not found", async () => {
    const tools = registerSkillTool("user-1");
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "unknown",
    });

    expect(result).toEqual({ error: 'Skill "unknown" not found.' });
  });

  it("filters out disabled skills in query and returns not found", async () => {
    const tools = registerSkillTool("user-1");
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "disabled-skill",
    });

    expect(result).toEqual({ error: 'Skill "disabled-skill" not found.' });
    expect(mockQuery.where).toHaveBeenCalled();
  });

  it("applies project scope condition when projectId context is provided", async () => {
    const tools = registerSkillTool("user-1", { projectId: "proj-1" });
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          name: "proj-skill",
          displayName: "Project Skill",
          description: "Desc",
          content: "Content",
          files: [],
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "proj-skill",
    });

    expect(result).toMatchObject({ name: "proj-skill" });
    expect(mockQuery.where).toHaveBeenCalled();
  });

  it("applies assistant scope condition when assistantId context is provided", async () => {
    const tools = registerSkillTool("user-1", { assistantId: "asst-1" });
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          name: "asst-skill",
          displayName: "Assistant Skill",
          description: "Desc",
          content: "Content",
          files: [],
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "asst-skill",
    });

    expect(result).toMatchObject({ name: "asst-skill" });
    expect(mockQuery.where).toHaveBeenCalled();
  });

  it("uses a longer fence when a bundled file contains a backtick run", async () => {
    const tools = registerSkillTool("user-1");
    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          name: "clean-code",
          displayName: "Clean Code",
          description: "Write clean code",
          content: "Use descriptive names.",
          files: [{ path: "a.md", content: "text\n```\ninjected\n```" }],
        },
      ]),
    };
    dbMock.select.mockReturnValue(mockQuery);

    const result = await (tools.load_skill as any).execute({
      skillName: "clean-code",
    });

    expect(result.instructions).toContain("text\n```\ninjected\n```\n````");
  });
});
