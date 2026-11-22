import { describe, expect, it } from "vitest";
import {
  buildToolApproval,
  DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS,
  INTERNAL_TOOL_NAMES,
  parseInternalToolApprovals,
  resolveInternalToolApproval,
} from "@/config/tool-approval";

describe("tool approval policy", () => {
  describe("DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS & INTERNAL_TOOL_NAMES", () => {
    it("includes expected auto-approved internal tools and scratchpad tools", () => {
      const expectedAuto = [
        "manage_artifact",
        "save_memory",
        "search_knowledge_base",
        "get_file_url",
        "load_skill",
        "read_skill_file",
        "delegate_task",
        "scratchpad_write",
        "scratchpad_read",
        "scratchpad_list",
        "manage_memory",
      ];

      for (const name of expectedAuto) {
        expect(DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS.has(name)).toBe(true);
        expect(INTERNAL_TOOL_NAMES.has(name)).toBe(true);
      }
    });

    it("includes gated skill mutation tools in INTERNAL_TOOL_NAMES but not auto-approved", () => {
      const gated = [
        "create_skill",
        "update_skill",
        "write_skill_file",
        "delete_skill_file",
      ];

      for (const name of gated) {
        expect(DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS.has(name)).toBe(false);
        expect(INTERNAL_TOOL_NAMES.has(name)).toBe(true);
      }
    });
  });

  describe("parseInternalToolApprovals", () => {
    it("returns an empty map for null, undefined, or empty string", () => {
      expect(parseInternalToolApprovals(null)).toEqual({});
      expect(parseInternalToolApprovals(undefined)).toEqual({});
      expect(parseInternalToolApprovals("")).toEqual({});
    });

    it("returns an empty map for malformed JSON or non-object JSON", () => {
      expect(parseInternalToolApprovals("{bad json")).toEqual({});
      expect(parseInternalToolApprovals("null")).toEqual({});
      expect(parseInternalToolApprovals('["ask"]')).toEqual({});
      expect(parseInternalToolApprovals('"ask"')).toEqual({});
    });

    it("keeps only valid 'ask' and 'auto' entries", () => {
      const raw = JSON.stringify({
        create_skill: "auto",
        save_memory: "ask",
        invalid_mode: "always",
        numeric: 123,
      });

      expect(parseInternalToolApprovals(raw)).toEqual({
        create_skill: "auto",
        save_memory: "ask",
      });
    });
  });

  describe("resolveInternalToolApproval", () => {
    it("falls back to default policy when no override is present", () => {
      expect(resolveInternalToolApproval("save_memory")).toBe("auto");
      expect(resolveInternalToolApproval("create_skill")).toBe("ask");
      expect(resolveInternalToolApproval("unknown_tool")).toBe("ask");
    });

    it("applies valid per-user overrides", () => {
      const overrides = {
        create_skill: "auto" as const,
        save_memory: "ask" as const,
      };
      expect(resolveInternalToolApproval("create_skill", overrides)).toBe(
        "auto",
      );
      expect(resolveInternalToolApproval("save_memory", overrides)).toBe("ask");
    });
  });

  describe("buildToolApproval", () => {
    const sampleTools = [
      "manage_artifact",
      "save_memory",
      "search_knowledge_base",
      "get_file_url",
      "load_skill",
      "read_skill_file",
      "delegate_task",
      "scratchpad_write",
      "scratchpad_read",
      "scratchpad_list",
      "create_skill",
      "update_skill",
      "write_skill_file",
      "delete_skill_file",
      "unknown_mcp_tool",
    ];

    it("auto-approves read/utility internal tools and gates skill-mutation and unknown MCP tools in 'ask' mode", () => {
      const result = buildToolApproval(sampleTools, "ask");

      expect(result).toEqual({
        manage_artifact: "not-applicable",
        save_memory: "not-applicable",
        search_knowledge_base: "not-applicable",
        get_file_url: "not-applicable",
        load_skill: "not-applicable",
        read_skill_file: "not-applicable",
        delegate_task: "not-applicable",
        scratchpad_write: "not-applicable",
        scratchpad_read: "not-applicable",
        scratchpad_list: "not-applicable",
        create_skill: "user-approval",
        update_skill: "user-approval",
        write_skill_file: "user-approval",
        delete_skill_file: "user-approval",
        unknown_mcp_tool: "user-approval",
      });
    });

    it("marks every tool as 'not-applicable' in 'auto' mode", () => {
      const result = buildToolApproval(sampleTools, "auto");

      for (const name of sampleTools) {
        expect(result[name]).toBe("not-applicable");
      }
    });

    it("respects per-user internalToolOverrides in 'ask' mode", () => {
      const result = buildToolApproval(
        ["create_skill", "save_memory"],
        "ask",
        {
          internalToolOverrides: {
            create_skill: "auto",
            save_memory: "ask",
          },
        },
      );

      expect(result).toEqual({
        create_skill: "not-applicable",
        save_memory: "user-approval",
      });
    });

    it("isolates MCP tool auto-approvals by serverId using raw tool names", () => {
      const result = buildToolApproval(
        ["search", "search_2", "delete_repo", "wildcard_tool"],
        "ask",
        {
          toolServerIdMap: {
            search: "server-a",
            search_2: "server-b",
            delete_repo: "server-a",
            wildcard_tool: "server-c",
          },
          toolRawNameMap: {
            search: "search",
            search_2: "search",
            delete_repo: "delete_repo",
            wildcard_tool: "wildcard_tool",
          },
          autoApprovedMcpToolsByServer: {
            "server-a": ["search"],
            "server-b": [],
            "server-c": ["*"],
          },
        },
      );

      expect(result).toEqual({
        search: "not-applicable",
        search_2: "user-approval",
        delete_repo: "user-approval",
        wildcard_tool: "not-applicable",
      });
    });

    it("auto-approves by runtime name when toolRawNameMap omits an entry", () => {
      const result = buildToolApproval(["fetch_docs"], "ask", {
        toolServerIdMap: { fetch_docs: "server-a" },
        autoApprovedMcpToolsByServer: { "server-a": ["fetch_docs"] },
      });

      expect(result).toEqual({ fetch_docs: "not-applicable" });
    });

    it("fails closed to 'user-approval' when serverId is missing or server is absent from allowlist", () => {
      const result = buildToolApproval(["orphan_tool", "unlisted_tool"], "ask", {
        toolServerIdMap: { unlisted_tool: "server-missing" },
        autoApprovedMcpToolsByServer: {},
      });

      expect(result).toEqual({
        orphan_tool: "user-approval",
        unlisted_tool: "user-approval",
      });
    });
  });
});
