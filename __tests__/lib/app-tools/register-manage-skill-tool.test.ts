import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const {
  mockCreateSkillForUser,
  mockUpdateSkillForUser,
  mockWriteSkillFileForUser,
  mockDeleteSkillFileForUser,
} = vi.hoisted(() => ({
  mockCreateSkillForUser: vi.fn(),
  mockUpdateSkillForUser: vi.fn(),
  mockWriteSkillFileForUser: vi.fn(),
  mockDeleteSkillFileForUser: vi.fn(),
}));

vi.mock("@/lib/skills/skill-crud-service", () => ({
  createSkillForUser: (...args: unknown[]) => mockCreateSkillForUser(...args),
  updateSkillForUser: (...args: unknown[]) => mockUpdateSkillForUser(...args),
}));

vi.mock("@/lib/skills/write-skill-file", () => ({
  writeSkillFileForUser: (...args: unknown[]) =>
    mockWriteSkillFileForUser(...args),
}));

vi.mock("@/lib/skills/delete-skill-file", () => ({
  deleteSkillFileForUser: (...args: unknown[]) =>
    mockDeleteSkillFileForUser(...args),
}));

import { registerManageSkillTool } from "@/lib/app-tools/register-manage-skill-tool";

describe("registerManageSkillTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets deferLoading: true by default and allows overriding to false", () => {
    const deferred = registerManageSkillTool("user-1");
    expect((deferred.manage_skill as { deferLoading?: boolean }).deferLoading).toBe(
      true,
    );

    const immediate = registerManageSkillTool("user-1", { deferLoading: false });
    expect((immediate.manage_skill as { deferLoading?: boolean }).deferLoading).toBe(
      false,
    );
  });

  it("handles create with slug normalisation, ROUTES.SKILLS.detail, and error catching", async () => {
    const { manage_skill } = registerManageSkillTool("user-1");

    const badSlug = await manage_skill.execute!(
      {
        action: "create",
        name: "Invalid Slug!",
        displayName: "Bad",
        description: "Desc",
        content: "Body",
      },
      { toolCallId: "tc-1", messages: [] },
    );
    expect(badSlug).toEqual({ success: false, error: expect.any(String) });

    mockCreateSkillForUser.mockResolvedValueOnce({
      id: "sk-1",
      name: "clean-code",
      displayName: "Clean Code",
    });

    const created = await manage_skill.execute!(
      {
        action: "create",
        name: '"[Clean-Code]"',
        displayName: "Clean Code",
        description: "Desc",
        content: "# Body",
      },
      { toolCallId: "tc-2", messages: [] },
    );
    expect(mockCreateSkillForUser).toHaveBeenCalledWith("user-1", {
      name: "clean-code",
      displayName: "Clean Code",
      description: "Desc",
      content: "# Body",
      files: [],
      enabled: true,
    });
    expect(created).toEqual({
      success: true,
      action: "create",
      id: "sk-1",
      skillId: "sk-1",
      name: "clean-code",
      skillName: "clean-code",
      displayName: "Clean Code",
      route: ROUTES.SKILLS.detail("sk-1"),
    });

    mockCreateSkillForUser.mockRejectedValueOnce(new Error("Duplicate slug"));
    const failed = await manage_skill.execute!(
      {
        action: "create",
        name: "clean-code",
        displayName: "Clean Code",
        description: "Desc",
        content: "# Body",
      },
      { toolCallId: "tc-3", messages: [] },
    );
    expect(failed).toEqual({ success: false, error: "Duplicate slug" });

    mockCreateSkillForUser.mockRejectedValueOnce("String error");
    const failedStr = await manage_skill.execute!(
      {
        action: "create",
        name: "clean-code",
        displayName: "Clean Code",
        description: "Desc",
        content: "# Body",
      },
      { toolCallId: "tc-4", messages: [] },
    );
    expect(failedStr).toEqual({ success: false, error: "String error" });
  });

  it("handles update, write_file, and delete_file actions", async () => {
    const { manage_skill } = registerManageSkillTool("user-1");

    expect(
      await manage_skill.execute!(
        { action: "update", skillName: "bad slug!", enabled: false },
        { toolCallId: "tc-5", messages: [] },
      ),
    ).toEqual({ success: false, error: expect.any(String) });

    mockUpdateSkillForUser.mockResolvedValueOnce(null);
    expect(
      await manage_skill.execute!(
        { action: "update", skillName: "missing-skill", enabled: false },
        { toolCallId: "tc-6", messages: [] },
      ),
    ).toEqual({ success: false, error: 'Skill "missing-skill" not found.' });

    mockUpdateSkillForUser.mockResolvedValueOnce({
      id: "sk-1",
      name: "clean-code",
      displayName: "Updated",
    });
    expect(
      await manage_skill.execute!(
        { action: "update", skillName: "clean-code" },
        { toolCallId: "tc-7b", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "update",
      id: "sk-1",
      skillId: "sk-1",
      name: "clean-code",
      skillName: "clean-code",
      route: ROUTES.SKILLS.detail("sk-1"),
    });

    mockUpdateSkillForUser.mockResolvedValueOnce({
      id: "sk-1",
      name: "clean-code",
      displayName: "Updated",
    });
    expect(
      await manage_skill.execute!(
        {
          action: "update",
          skillName: "clean-code",
          displayName: "Updated",
          description: "New",
          enabled: true,
        },
        { toolCallId: "tc-7", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "update",
      id: "sk-1",
      skillId: "sk-1",
      name: "clean-code",
      skillName: "clean-code",
      route: ROUTES.SKILLS.detail("sk-1"),
    });

    expect(
      await manage_skill.execute!(
        {
          action: "write_file",
          skillName: "bad slug!",
          path: "SKILL.md",
          content: "x",
        },
        { toolCallId: "tc-8", messages: [] },
      ),
    ).toEqual({ success: false, error: expect.any(String) });

    mockWriteSkillFileForUser.mockResolvedValueOnce({ error: "Invalid path" });
    expect(
      await manage_skill.execute!(
        {
          action: "write_file",
          skillName: "clean-code",
          path: "../bad",
          content: "x",
        },
        { toolCallId: "tc-9", messages: [] },
      ),
    ).toEqual({ success: false, error: "Invalid path" });

    mockWriteSkillFileForUser.mockResolvedValueOnce({
      action: "created",
      skill: { id: "sk-1", name: "clean-code" },
      path: "references/guide.md",
      target: "files",
    });
    expect(
      await manage_skill.execute!(
        {
          action: "write_file",
          skillName: "clean-code",
          path: '"references/guide.md"',
          content: "guide",
        },
        { toolCallId: "tc-10", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "write_file",
      fileAction: "created",
      id: "sk-1",
      skillId: "sk-1",
      name: "clean-code",
      skillName: "clean-code",
      path: "references/guide.md",
      target: "files",
      route: ROUTES.SKILLS.detail("sk-1"),
    });

    expect(
      await manage_skill.execute!(
        {
          action: "delete_file",
          skillName: "bad slug!",
          path: "references/guide.md",
        },
        { toolCallId: "tc-11", messages: [] },
      ),
    ).toEqual({ success: false, error: expect.any(String) });

    mockDeleteSkillFileForUser.mockResolvedValueOnce({
      error: "Cannot delete SKILL.md",
    });
    expect(
      await manage_skill.execute!(
        {
          action: "delete_file",
          skillName: "clean-code",
          path: "SKILL.md",
        },
        { toolCallId: "tc-12", messages: [] },
      ),
    ).toEqual({ success: false, error: "Cannot delete SKILL.md" });

    mockDeleteSkillFileForUser.mockResolvedValueOnce({
      skill: { id: "sk-1", name: "clean-code" },
      path: "references/guide.md",
    });
    expect(
      await manage_skill.execute!(
        {
          action: "delete_file",
          skillName: "clean-code",
          path: "references/guide.md",
        },
        { toolCallId: "tc-13", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "delete_file",
      id: "sk-1",
      skillId: "sk-1",
      name: "clean-code",
      skillName: "clean-code",
      path: "references/guide.md",
      route: ROUTES.SKILLS.detail("sk-1"),
    });
  });

  it("rejects empty displayName or description in update inputSchema while allowing omitted fields", () => {
    const { manage_skill } = registerManageSkillTool("user-1");
    const schema = manage_skill.inputSchema as {
      safeParse: (v: unknown) => { success: boolean };
    };

    expect(
      schema.safeParse({
        action: "update",
        skillName: "clean-code",
        displayName: "",
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        action: "update",
        skillName: "clean-code",
        description: "",
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        action: "update",
        skillName: "clean-code",
        enabled: false,
      }).success,
    ).toBe(true);
  });
});
