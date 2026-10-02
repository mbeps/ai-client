import {
  AUTO_APPROVED_TOOLS,
  buildToolApproval,
} from "@/config/tool-approval";
import { describe, expect, it } from "vitest";

describe("buildToolApproval", () => {
  it("runs every tool without asking in auto mode", () => {
    expect(buildToolApproval(["a", "b"], "auto")).toEqual({
      a: "not-applicable",
      b: "not-applicable",
    });
  });

  it("never asks for an allowlisted tool", () => {
    expect(buildToolApproval(["manage_artifact"], "ask")).toEqual({
      manage_artifact: "not-applicable",
    });
  });

  it("asks for a tool that is not allowlisted", () => {
    expect(buildToolApproval(["delete_skill_file"], "ask")).toEqual({
      delete_skill_file: "user-approval",
    });
  });

  it("fails closed for an unknown tool name", () => {
    // V14: a name missing from the map executes with no approval at all.
    expect(buildToolApproval(["brand_new_mcp_tool"], "ask")).toEqual({
      brand_new_mcp_tool: "user-approval",
    });
  });

  it("returns an empty map for an empty tool set", () => {
    expect(buildToolApproval([], "ask")).toEqual({});
  });

  it("allowlists only read-only or presentational tools", () => {
    expect([...AUTO_APPROVED_TOOLS].sort()).toEqual([
      "get_file_url",
      "load_skill",
      "manage_artifact",
      "read_skill_file",
      "search_knowledge_base",
    ]);
  });
});