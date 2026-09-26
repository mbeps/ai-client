import { describe, expect, it, vi } from "vitest";
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
});
