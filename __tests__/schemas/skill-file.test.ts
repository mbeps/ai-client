import { describe, expect, it } from "vitest";
import {
  SKILL_BUNDLE_MAX_BYTES,
  SKILL_FILE_MAX_BYTES,
  SKILL_FILE_MAX_COUNT,
} from "@/config/skills";
import {
  assertSkillBodyWithinBudget,
  assertSkillBundleWithinBudget,
  isSkillBodyPath,
  SKILL_FILE_PATH_ERROR,
  SkillBundleBudgetError,
  skillFilePathSchema,
} from "@/schemas/skill/skill-file";

describe("skillFilePathSchema", () => {
  it("accepts a nested reference path and collapses duplicate slashes", () => {
    expect(skillFilePathSchema.parse("/references//guide.md")).toBe(
      "references/guide.md",
    );
  });

  it("accepts SKILL.md in any letter case and normalises it", () => {
    expect(skillFilePathSchema.parse("skill.md")).toBe("SKILL.md");
  });

  it("rejects parent directory traversal", () => {
    expect(skillFilePathSchema.safeParse("../.env").success).toBe(false);
    expect(skillFilePathSchema.safeParse("references/../../.env").success).toBe(
      false,
    );
  });

  it("rejects a Windows style traversal attempt", () => {
    expect(skillFilePathSchema.safeParse("references\\a.md").success).toBe(false);
    expect(skillFilePathSchema.safeParse("..\\..\\.env").success).toBe(false);
  });

  it("rejects a current directory segment", () => {
    expect(skillFilePathSchema.safeParse("./a.md").success).toBe(false);
  });

  it("rejects a control character", () => {
    expect(skillFilePathSchema.safeParse("references/a\u0000b.md").success).toBe(
      false,
    );
  });

  it("rejects a directory path with no file name", () => {
    expect(skillFilePathSchema.safeParse("references/").success).toBe(false);
  });

  it("rejects a path deeper than the depth limit", () => {
    const deep =
      Array.from({ length: 6 }, (_, i) => `d${i}`).join("/") + "/f.md";
    expect(skillFilePathSchema.safeParse(deep).success).toBe(false);
  });

  it("rejects a path longer than the length limit", () => {
    expect(skillFilePathSchema.safeParse(`${"a".repeat(300)}.md`).success).toBe(
      false,
    );
  });

  it("rejects __MACOSX and .DS_Store in any letter case", () => {
    expect(skillFilePathSchema.safeParse("__MACOSX/x").success).toBe(false);
    expect(skillFilePathSchema.safeParse("references/.ds_store").success).toBe(
      false,
    );
  });

  it("rejects an empty path", () => {
    expect(skillFilePathSchema.safeParse("   ")).toMatchObject({
      error: { issues: [{ message: SKILL_FILE_PATH_ERROR }] },
    });
  });

  it("rejects a zero length path", () => {
    expect(skillFilePathSchema.safeParse("").success).toBe(false);
  });

  it("rejects a path that is nothing but whitespace", () => {
    expect(skillFilePathSchema.safeParse("  ").success).toBe(false);
  });
});

describe("isSkillBodyPath", () => {
  it("recognises SKILL.md regardless of case or wrapping slashes", () => {
    expect(isSkillBodyPath("SKILL.md")).toBe(true);
    expect(isSkillBodyPath("/skill.md/")).toBe(true);
  });

  it("rejects a reference path", () => {
    expect(isSkillBodyPath("references/SKILL.md")).toBe(false);
  });
});

describe("assertSkillBundleWithinBudget", () => {
  it("accepts a bundle inside every limit", () => {
    expect(() =>
      assertSkillBundleWithinBudget([{ path: "a.md", content: "x".repeat(10) }]),
    ).not.toThrow();
  });

  it("accepts an empty bundle", () => {
    expect(() => assertSkillBundleWithinBudget([])).not.toThrow();
  });

  it("rejects a bundle with too many files", () => {
    const files = Array.from(
      { length: SKILL_FILE_MAX_COUNT + 1 },
      (_, i) => ({ path: `f${i}.md`, content: "" }),
    );
    expect(() => assertSkillBundleWithinBudget(files)).toThrow(
      SkillBundleBudgetError,
    );
  });

  it("rejects a bundle containing one oversized file", () => {
    expect(() =>
      assertSkillBundleWithinBudget([
        { path: "a.md", content: "x".repeat(SKILL_FILE_MAX_BYTES + 1) },
      ]),
    ).toThrow(SkillBundleBudgetError);
  });

  it("rejects a bundle whose total size is over the limit", () => {
    const files = Array.from({ length: 5 }, () => ({
      path: "a.md",
      content: "x".repeat(SKILL_BUNDLE_MAX_BYTES / 4),
    }));
    expect(() => assertSkillBundleWithinBudget(files)).toThrow(
      SkillBundleBudgetError,
    );
  });

  it("carries a machine readable code for the caller", () => {
    try {
      assertSkillBundleWithinBudget([
        { path: "a.md", content: "x".repeat(SKILL_FILE_MAX_BYTES + 1) },
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as SkillBundleBudgetError).code).toBe(
        "SKILL_BUNDLE_BUDGET_EXCEEDED",
      );
    }
  });
});

describe("assertSkillBodyWithinBudget", () => {
  it("accepts a body inside the limit", () => {
    expect(() => assertSkillBodyWithinBudget("x".repeat(10))).not.toThrow();
  });

  it("rejects an oversized SKILL.md body", () => {
    expect(() => assertSkillBodyWithinBudget("x".repeat(300000))).toThrow(
      SkillBundleBudgetError,
    );
  });
});
