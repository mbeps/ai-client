import { describe, expect, it } from "vitest";
import {
  sanitiseToolName,
  sanitiseToolNames,
} from "@/lib/mcp/sanitise-tool-names";

describe("sanitiseToolName", () => {
  it("preserves already valid names", () => {
    expect(sanitiseToolName("create_issue")).toBe("create_issue");
    expect(sanitiseToolName("search-docs_123")).toBe("search-docs_123");
    expect(sanitiseToolName("MyTool")).toBe("MyTool");
  });

  it("replaces dots and spaces with underscores", () => {
    expect(sanitiseToolName("github.create_issue")).toBe("github_create_issue");
    expect(sanitiseToolName("my tool:action")).toBe("my_tool_action");
  });

  it("replaces special symbols and slashes", () => {
    expect(sanitiseToolName("org/repo@action!")).toBe("org_repo_action_");
  });

  it("truncates names exceeding 64 characters", () => {
    const longName = "a".repeat(80);
    const result = sanitiseToolName(longName);
    expect(result).toHaveLength(64);
    expect(result).toBe("a".repeat(64));
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(sanitiseToolName("")).toBe("tool");
    expect(sanitiseToolName(null as any)).toBe("tool");
    expect(sanitiseToolName(undefined as any)).toBe("tool");
  });
});

describe("sanitiseToolNames", () => {
  it("sanitises keys in a tools record and updates maps", () => {
    const tools = {
      "github.create_issue": { id: 1 },
      valid_tool: { id: 2 },
    };
    const sourceMap = {
      "github.create_issue": "GitHub Server",
      valid_tool: "Core Server",
    };
    const serverIdMap = {
      "github.create_issue": "srv-1",
      valid_tool: "srv-2",
    };

    const result = sanitiseToolNames(tools, sourceMap, serverIdMap);

    expect(Object.keys(result.tools)).toEqual([
      "github_create_issue",
      "valid_tool",
    ]);
    expect(result.tools.github_create_issue).toEqual({ id: 1 });
    expect(result.tools.valid_tool).toEqual({ id: 2 });

    expect(result.toolSourceMap).toEqual({
      github_create_issue: "GitHub Server",
      valid_tool: "Core Server",
    });
    expect(result.toolServerIdMap).toEqual({
      github_create_issue: "srv-1",
      valid_tool: "srv-2",
    });
  });

  it("handles collision between tools after sanitisation", () => {
    const tools = {
      "foo.bar": { v: 1 },
      "foo_bar": { v: 2 },
      "foo:bar": { v: 3 },
    };
    const sourceMap = {
      "foo.bar": "S1",
      "foo_bar": "S2",
      "foo:bar": "S3",
    };

    const result = sanitiseToolNames(tools, sourceMap);

    expect(Object.keys(result.tools)).toEqual([
      "foo_bar",
      "foo_bar_2",
      "foo_bar_3",
    ]);
    expect(result.tools.foo_bar).toEqual({ v: 1 });
    expect(result.tools.foo_bar_2).toEqual({ v: 2 });
    expect(result.tools.foo_bar_3).toEqual({ v: 3 });

    expect(result.toolSourceMap.foo_bar).toBe("S1");
    expect(result.toolSourceMap.foo_bar_2).toBe("S2");
    expect(result.toolSourceMap.foo_bar_3).toBe("S3");
  });

  it("handles collision when name is near 64 characters without exceeding 64", () => {
    const name64 = "x".repeat(64);
    const tools = {
      [name64]: { id: 1 },
      [`${name64}!`]: { id: 2 },
    };

    const result = sanitiseToolNames(tools);
    const keys = Object.keys(result.tools);

    expect(keys[0]).toHaveLength(64);
    expect(keys[1]).toHaveLength(64);
    expect(keys[1]?.endsWith("_2")).toBe(true);
  });
});
