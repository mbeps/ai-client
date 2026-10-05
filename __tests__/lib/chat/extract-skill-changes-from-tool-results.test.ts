import { describe, expect, it } from "vitest";
import { extractSkillChangesFromToolResults } from "@/lib/chat/extract-skill-changes-from-tool-results";

describe("extractSkillChangesFromToolResults", () => {
  it("returns an empty list for a non-array input", () => {
    expect(extractSkillChangesFromToolResults(undefined)).toEqual([]);
    expect(extractSkillChangesFromToolResults(null)).toEqual([]);
    expect(extractSkillChangesFromToolResults("nope")).toEqual([]);
  });

  it("returns an empty list for an empty array", () => {
    expect(extractSkillChangesFromToolResults([])).toEqual([]);
  });

  it("returns an empty list when no authoring tool ran", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "manage_artifact", result: { skillId: "s1" } },
      ]),
    ).toEqual([]);
  });

  it("collects distinct skill ids across several calls", () => {
    const input = [
      { toolName: "create_skill", result: { success: true, skillId: "s1" } },
      { toolName: "write_skill_file", result: { success: true, skillId: "s1" } },
      { toolName: "update_skill", result: { success: true, skillId: "s2" } },
    ];
    expect(extractSkillChangesFromToolResults(input)).toEqual(["s1", "s2"]);
  });

  it("ignores the read tool, which never changes a skill", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "read_skill_file", result: { skillId: "s1" } },
      ]),
    ).toEqual([]);
  });

  it("recognises every mutating authoring tool by name", () => {
    const input = [
      "create_skill",
      "update_skill",
      "write_skill_file",
      "delete_skill_file",
    ].map((toolName) => ({
      toolName,
      result: { success: true, skillId: `${toolName}-id` },
    }));
    expect(extractSkillChangesFromToolResults(input)).toHaveLength(4);
  });

  it("ignores a failed result that carries no skill id", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "write_skill_file", result: { error: "nope" } },
      ]),
    ).toEqual([]);
  });

  it("ignores a JSON stringified result that has no skill id", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", result: '{"success":true}' },
      ]),
    ).toEqual([]);
  });

  it("reads a skill id from a JSON stringified result", () => {
    expect(
      extractSkillChangesFromToolResults([
        {
          toolName: "create_skill",
          result: JSON.stringify({ success: true, skillId: "s9" }),
        },
      ]),
    ).toEqual(["s9"]);
  });

  it("ignores a malformed JSON result", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", result: "{not json" },
      ]),
    ).toEqual([]);
  });

  it("ignores a result that parses to a non-object", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", result: '"just a string"' },
      ]),
    ).toEqual([]);
  });

  it("ignores a null result", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", result: null, output: null },
      ]),
    ).toEqual([]);
  });

  it("falls back to the output key when result is absent", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", output: { skillId: "s5" } },
      ]),
    ).toEqual(["s5"]);
  });

  it("ignores an entry whose tool name is not a string", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: 42, result: { skillId: "s1" } },
        { result: { skillId: "s2" } },
      ]),
    ).toEqual([]);
  });

  it("ignores an entry that is not an object", () => {
    expect(
      extractSkillChangesFromToolResults(["nope", 42, null]),
    ).toEqual([]);
  });

  it("ignores a skill id that is not a non-empty string", () => {
    expect(
      extractSkillChangesFromToolResults([
        { toolName: "create_skill", result: { skillId: "" } },
        { toolName: "create_skill", result: { skillId: 7 } },
      ]),
    ).toEqual([]);
  });
});
