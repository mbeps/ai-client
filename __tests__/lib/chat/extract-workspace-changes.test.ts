import { describe, expect, it } from "vitest";
import { extractWorkspaceChangesFromToolResults } from "@/lib/chat/extract-workspace-changes";

describe("extractWorkspaceChangesFromToolResults", () => {
  it("returns an empty set for non-arrays or empty arrays", () => {
    expect(extractWorkspaceChangesFromToolResults(undefined)).toEqual(new Set());
    expect(extractWorkspaceChangesFromToolResults(null)).toEqual(new Set());
    expect(extractWorkspaceChangesFromToolResults("nope")).toEqual(new Set());
    expect(extractWorkspaceChangesFromToolResults([])).toEqual(new Set());
  });

  it("maps all 6 workspace mutation domains when successful", () => {
    const domains = extractWorkspaceChangesFromToolResults([
      { toolName: "manage_skill", result: { success: true, id: "s1" } },
      { toolName: "manage_project", result: { success: true, id: "p1" } },
      { toolName: "manage_agent", result: { success: true, id: "a1" } },
      { toolName: "manage_prompt", result: { success: true, id: "pr1" } },
      { toolName: "manage_workflow", result: { success: true, id: "w1" } },
      { toolName: "save_memory", result: { success: true, id: "m1" } },
    ]);

    expect(domains).toEqual(
      new Set(["skills", "projects", "agents", "prompts", "workflows", "memories"]),
    );
  });

  it("supports legacy skill tool names and JSON-stringified results", () => {
    const domains = extractWorkspaceChangesFromToolResults([
      { toolName: "create_skill", result: '{"success":true,"skillId":"s1"}' },
      { toolName: "update_skill", result: { skillId: "s2" } },
      { toolName: "write_skill_file", result: { skillId: "s3" } },
      { toolName: "delete_skill_file", result: { skillId: "s4" } },
      { toolName: "manage_memory", result: { id: "m2" } },
    ]);

    expect(domains).toEqual(new Set(["skills", "memories"]));
  });

  it("ignores failed, errored, malformed, or read-only tool results", () => {
    const domains = extractWorkspaceChangesFromToolResults([
      null,
      "bad",
      { toolName: 123, result: { success: true } },
      { toolName: "app_help", result: { topic: "overview" } },
      { toolName: "inspect_workspace", result: { success: true } },
      { toolName: "manage_project", result: { success: false, error: "Denied" } },
      { toolName: "manage_agent", result: { error: "Failed" } },
      { toolName: "manage_workflow", result: "{not json" },
      { toolName: "manage_prompt", result: '"just a string"' },
      { toolName: "manage_skill", result: null },
      { toolName: "manage_skill" },
    ]);

    expect(domains).toEqual(new Set());
  });
});
