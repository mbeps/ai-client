import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMock = vi.hoisted(() => ({
  createSkillForUser: vi.fn(),
  updateSkillForUser: vi.fn(),
  writeSkillFileForUser: vi.fn(),
  readSkillFileForUser: vi.fn(),
  listSkillFilesForUser: vi.fn(),
  deleteSkillFileForUser: vi.fn(),
}));
vi.mock("@/lib/skills/skill-service", () => serviceMock);
vi.mock("@/lib/skills/skill-file-service", () => ({
  writeSkillFileForUser: serviceMock.writeSkillFileForUser,
  readSkillFileForUser: serviceMock.readSkillFileForUser,
  listSkillFilesForUser: serviceMock.listSkillFilesForUser,
  deleteSkillFileForUser: serviceMock.deleteSkillFileForUser,
}));

import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";

const call = (tools: any, name: string, input: unknown) =>
  tools[name].execute(input, {});

const skillRow = { id: "s1", name: "clean-code" };

beforeEach(() => {
  for (const fn of Object.values(serviceMock)) fn.mockReset();
});

describe("registerSkillAuthoringTools", () => {
  it("registers exactly the five authoring tools", () => {
    expect(Object.keys(registerSkillAuthoringTools("user-1")).sort()).toEqual([
      "create_skill",
      "delete_skill_file",
      "read_skill_file",
      "update_skill",
      "write_skill_file",
    ]);
  });
});

describe("create_skill", () => {
  it("normalises the slug before creating and returns the identifiers", async () => {
    serviceMock.createSkillForUser.mockResolvedValue(skillRow);
    const result = await call(registerSkillAuthoringTools("user-1"), "create_skill", {
      name: "  Clean-Code ",
      displayName: "Clean Code",
      description: "d",
      content: "c",
    });
    expect(serviceMock.createSkillForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "clean-code" }),
    );
    expect(result).toMatchObject({
      success: true,
      skillId: "s1",
      skillName: "clean-code",
    });
  });

  it("returns an error when the slug is invalid and does not call the service", async () => {
    const result = await call(registerSkillAuthoringTools("user-1"), "create_skill", {
      name: "Bad Name!",
      displayName: "x",
      description: "d",
      content: "c",
    });
    expect(result).toEqual({ error: expect.any(String) });
    expect(serviceMock.createSkillForUser).not.toHaveBeenCalled();
  });

  it("strips wrapping brackets from a quoted slug", async () => {
    serviceMock.createSkillForUser.mockResolvedValue(skillRow);
    await call(registerSkillAuthoringTools("user-1"), "create_skill", {
      name: '"clean-code"',
      displayName: "x",
      description: "d",
      content: "c",
    });
    expect(serviceMock.createSkillForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "clean-code" }),
    );
  });
});

describe("update_skill", () => {
  it("returns the identifiers on success", async () => {
    serviceMock.updateSkillForUser.mockResolvedValue(skillRow);
    const result = await call(registerSkillAuthoringTools("user-1"), "update_skill", {
      skillName: "clean-code",
      description: "d",
    });
    expect(result).toMatchObject({ success: true, skillId: "s1" });
  });

  it("returns a not found error when the service returns null", async () => {
    serviceMock.updateSkillForUser.mockResolvedValue(null);
    expect(
      await call(registerSkillAuthoringTools("user-1"), "update_skill", {
        skillName: "x",
        description: "d",
      }),
    ).toEqual({ error: expect.any(String) });
  });

  it("returns an error when the skill name is not a valid slug", async () => {
    const result = await call(registerSkillAuthoringTools("user-1"), "update_skill", {
      skillName: "Not A Slug",
      description: "d",
    });
    expect(result).toEqual({ error: expect.any(String) });
    expect(serviceMock.updateSkillForUser).not.toHaveBeenCalled();
  });

  it("forwards a display name change", async () => {
    serviceMock.updateSkillForUser.mockResolvedValue(skillRow);
    await call(registerSkillAuthoringTools("user-1"), "update_skill", {
      skillName: "clean-code",
      displayName: "New Title",
    });
    expect(serviceMock.updateSkillForUser).toHaveBeenCalledWith(
      "user-1",
      "clean-code",
      { displayName: "New Title" },
    );
  });

  it("forwards an enabled change", async () => {
    serviceMock.updateSkillForUser.mockResolvedValue(skillRow);
    await call(registerSkillAuthoringTools("user-1"), "update_skill", {
      skillName: "clean-code",
      enabled: false,
    });
    expect(serviceMock.updateSkillForUser).toHaveBeenCalledWith(
      "user-1",
      "clean-code",
      { enabled: false },
    );
  });
});

describe("write_skill_file", () => {
  it("strips wrapping brackets from a quoted path", async () => {
    serviceMock.writeSkillFileForUser.mockResolvedValue({
      path: "a.md",
      target: "bundled",
      action: "created",
      skill: skillRow,
    });
    await call(registerSkillAuthoringTools("user-1"), "write_skill_file", {
      skillName: "clean-code",
      path: '"a.md"',
      content: "x",
    });
    expect(serviceMock.writeSkillFileForUser).toHaveBeenCalledWith(
      "user-1",
      "clean-code",
      "a.md",
      "x",
    );
  });

  it("returns the action and identifiers on success", async () => {
    serviceMock.writeSkillFileForUser.mockResolvedValue({
      path: "a.md",
      target: "bundled",
      action: "created",
      skill: skillRow,
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "write_skill_file", {
        skillName: "clean-code",
        path: "a.md",
        content: "x",
      }),
    ).toMatchObject({ success: true, action: "created", skillId: "s1" });
  });

  it("passes a service refusal straight through", async () => {
    serviceMock.writeSkillFileForUser.mockResolvedValue({
      error: "Invalid skill file path.",
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "write_skill_file", {
        skillName: "x",
        path: "../a",
        content: "y",
      }),
    ).toEqual({ error: "Invalid skill file path." });
  });

  it("returns an error when the skill name is not a valid slug", async () => {
    expect(
      await call(registerSkillAuthoringTools("user-1"), "write_skill_file", {
        skillName: "Not A Slug",
        path: "a.md",
        content: "y",
      }),
    ).toEqual({ error: expect.any(String) });
    expect(serviceMock.writeSkillFileForUser).not.toHaveBeenCalled();
  });

  it("reports the bundled target on a body write", async () => {
    serviceMock.writeSkillFileForUser.mockResolvedValue({
      path: "SKILL.md",
      target: "skill-md",
      action: "updated",
      skill: skillRow,
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "write_skill_file", {
        skillName: "clean-code",
        path: "SKILL.md",
        content: "y",
      }),
    ).toMatchObject({ action: "updated", target: "skill-md" });
  });
});

describe("read_skill_file", () => {
  it("returns the manifest when no path is supplied", async () => {
    serviceMock.listSkillFilesForUser.mockResolvedValue({
      manifest: [{ path: "a.md", bytes: 1 }],
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "x",
      }),
    ).toEqual({ manifest: [{ path: "a.md", bytes: 1 }] });
  });

  it("returns a not found error when the manifest is missing", async () => {
    serviceMock.listSkillFilesForUser.mockResolvedValue(null);
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "x",
      }),
    ).toEqual({ error: expect.any(String) });
  });

  it("returns the content when a path is supplied", async () => {
    serviceMock.readSkillFileForUser.mockResolvedValue({
      path: "a.md",
      bytes: 1,
      target: "bundled",
      content: "A",
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "x",
        path: "a.md",
      }),
    ).toMatchObject({ content: "A" });
  });

  it("returns a not found error when the path is missing", async () => {
    serviceMock.readSkillFileForUser.mockResolvedValue(null);
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "x",
        path: "a.md",
      }),
    ).toEqual({ error: expect.any(String) });
  });

  it("returns an error when the skill name is not a valid slug", async () => {
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "Not A Slug",
      }),
    ).toEqual({ error: expect.any(String) });
    expect(serviceMock.listSkillFilesForUser).not.toHaveBeenCalled();
  });

  it("returns an error on a read when the skill name is not a valid slug", async () => {
    expect(
      await call(registerSkillAuthoringTools("user-1"), "read_skill_file", {
        skillName: "Not A Slug",
        path: "a.md",
      }),
    ).toEqual({ error: expect.any(String) });
    expect(serviceMock.readSkillFileForUser).not.toHaveBeenCalled();
  });
});

describe("delete_skill_file", () => {
  it("returns the identifiers on success", async () => {
    serviceMock.deleteSkillFileForUser.mockResolvedValue({
      skill: skillRow,
      path: "a.md",
    });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "delete_skill_file", {
        skillName: "clean-code",
        path: "a.md",
      }),
    ).toMatchObject({ success: true, path: "a.md" });
  });

  it("passes a service refusal straight through", async () => {
    serviceMock.deleteSkillFileForUser.mockResolvedValue({ error: "nope" });
    expect(
      await call(registerSkillAuthoringTools("user-1"), "delete_skill_file", {
        skillName: "x",
        path: "a.md",
      }),
    ).toEqual({ error: "nope" });
  });

  it("returns an error when the skill name is not a valid slug", async () => {
    expect(
      await call(registerSkillAuthoringTools("user-1"), "delete_skill_file", {
        skillName: "Not A Slug",
        path: "a.md",
      }),
    ).toEqual({ error: expect.any(String) });
    expect(serviceMock.deleteSkillFileForUser).not.toHaveBeenCalled();
  });
});
