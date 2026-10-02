import { describe, expect, it } from "vitest";
import {
  SKILL_BODY_MAX_BYTES,
  SKILL_BUNDLE_MAX_BYTES,
  SKILL_FILE_MAX_BYTES,
  SKILL_FILE_MAX_COUNT,
  SKILL_FILE_MAX_DEPTH,
  SKILL_FILE_PATH_MAX_LENGTH,
  SKILL_RESERVED_PATHS,
} from "@/config/skills";

describe("skill limits", () => {
  it("pins every limit so a policy change is a deliberate edit", () => {
    expect(SKILL_FILE_PATH_MAX_LENGTH).toBe(255);
    expect(SKILL_FILE_MAX_DEPTH).toBe(5);
    expect(SKILL_FILE_MAX_COUNT).toBe(50);
    expect(SKILL_FILE_MAX_BYTES).toBe(262144);
    expect(SKILL_BUNDLE_MAX_BYTES).toBe(1048576);
    expect(SKILL_BODY_MAX_BYTES).toBe(262144);
    expect(SKILL_RESERVED_PATHS).toEqual(["SKILL.md", "__MACOSX", ".DS_Store"]);
  });
});
