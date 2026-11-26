import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useChatInputSelections } from "@/components/chat/input/use-chat-input-selections";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";
import { useChatInteraction } from "@/components/chat/input/use-chat-interaction";
import { LINKABLE_BUILT_IN_AGENT_IDS } from "@/config/built-in-agents";
import { useAppStore } from "@/lib/store/use-app-store";

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));

describe("useChatInputSelections - knowledgebase sync & mentions", () => {
  const baseProps = {
    initialSelectedServerIds: [],
    initialSelectedTools: [],
    initialSelectedKbs: [] as string[],
    initialSelectedSkillIds: [],
    initialSubagentsEnabled: false,
  };

  it("syncs selectedKbs when initialSelectedKbs hydrates after mount", () => {
    const { result, rerender } = renderHook(
      (props) => useChatInputSelections(props),
      { initialProps: baseProps },
    );

    expect(Array.from(result.current.selectedKbs)).toEqual([]);

    rerender({
      ...baseProps,
      initialSelectedKbs: ["kb-agent-1", "kb-agent-2"],
    });

    expect(Array.from(result.current.selectedKbs)).toEqual([
      "kb-agent-1",
      "kb-agent-2",
    ]);
  });

  it("calls onKnowledgebaseChange when adding a KB via onMentionKb", () => {
    const onKnowledgebaseChange = vi.fn();
    const { result } = renderHook(() =>
      useChatInputSelections({
        ...baseProps,
        initialSelectedKbs: ["kb-agent-1"],
        onKnowledgebaseChange,
      }),
    );

    act(() => {
      result.current.onMentionKb({ id: "kb-mentioned-1" });
    });

    expect(Array.from(result.current.selectedKbs)).toEqual([
      "kb-agent-1",
      "kb-mentioned-1",
    ]);
    expect(onKnowledgebaseChange).toHaveBeenCalledWith([
      "kb-agent-1",
      "kb-mentioned-1",
    ]);
  });

  it("auto-enables subagents when mentioning an assistant with subagentIds in useChatInteraction", () => {
    const orchestratorAgent = {
      id: "asst-orch-1",
      name: "Orchestrator",
      description: "Delegates tasks",
      prompt: "Prompt",
      tools: [],
      subagentIds: ["sub-1"],
      updatedAt: new Date(),
    } as any;

    useAppStore.setState({
      agents: [orchestratorAgent],
      prompts: [],
      skills: [],
      mcpPrompts: [],
    });

    const textareaRef = createRef<HTMLTextAreaElement>();
    const setInput = vi.fn();

    const { result } = renderHook(() =>
      useChatInteraction({
        props: {
          onSend: vi.fn(),
          initialSubagentsEnabled: false,
        },
        services: {
          supportsVision: true,
          supportsTools: true,
          hasNoModels: false,
          modelId: "gpt-4o",
          skills: [],
          knowledgebases: [],
          handleApiError: vi.fn(),
        } as any,
        input: "@orch",
        setInput,
        textareaRef,
        canMentionAssistant: true,
      }),
    );

    expect(result.current.selections.subagentsEnabled).toBe(false);

    act(() => {
      result.current.mentions.setSelectedAssistant(orchestratorAgent);
    });

    expect(result.current.selections.subagentsEnabled).toBe(true);
    expect(result.current.selections.selectedSubagentIds).toEqual(["sub-1"]);
  });

  it("defaults selectedSubagentIds to LINKABLE_BUILT_IN_AGENT_IDS and syncs on hydration", () => {
    const { result, rerender } = renderHook(
      (props: typeof baseProps & { initialSubagentIds?: string[] }) =>
        useChatInputSelections(props),
      { initialProps: baseProps },
    );

    expect(result.current.selectedSubagentIds).toEqual([
      ...LINKABLE_BUILT_IN_AGENT_IDS,
    ]);

    rerender({
      ...baseProps,
      initialSubagentIds: ["builtin:planner", "custom-1"],
    });

    expect(result.current.selectedSubagentIds).toEqual([
      "builtin:planner",
      "custom-1",
    ]);
  });

  it("toggles and bulk-selects subagent IDs via handleToggleSubagentId and handleSelectSubagentIds", () => {
    const { result } = renderHook(() =>
      useChatInputSelections({
        ...baseProps,
        initialSubagentIds: ["builtin:researcher"],
      }),
    );

    expect(result.current.selectedSubagentIds).toEqual(["builtin:researcher"]);

    act(() => {
      result.current.handleToggleSubagentId("custom-1");
    });
    expect(result.current.selectedSubagentIds).toEqual([
      "builtin:researcher",
      "custom-1",
    ]);

    act(() => {
      result.current.handleToggleSubagentId("builtin:researcher");
    });
    expect(result.current.selectedSubagentIds).toEqual(["custom-1"]);

    act(() => {
      result.current.handleSelectSubagentIds([
        "builtin:planner",
        "builtin:worker",
      ]);
    });
    expect(result.current.selectedSubagentIds).toEqual([
      "builtin:planner",
      "builtin:worker",
    ]);

    act(() => {
      result.current.handleSelectSubagentIds([]);
    });
    expect(result.current.selectedSubagentIds).toEqual([]);
  });

  it("preserves restored delegation settings when editing a message with initialSelectedAssistantId", () => {
    const agentA = {
      id: "asst-a",
      name: "Agent A",
      description: "First",
      prompt: "Prompt A",
      tools: [],
      subagentIds: ["sub-b", "sub-c"],
      updatedAt: new Date(),
    } as any;
    const agentD = {
      id: "asst-d",
      name: "Agent D",
      description: "Second",
      prompt: "Prompt D",
      tools: [],
      subagentIds: ["sub-e"],
      updatedAt: new Date(),
    } as any;

    useAppStore.setState({
      agents: [agentA, agentD],
      prompts: [],
      skills: [],
      mcpPrompts: [],
    });

    const textareaRef = createRef<HTMLTextAreaElement>();
    const { result } = renderHook(() =>
      useChatInteraction({
        props: {
          onSend: vi.fn(),
          initialSelectedAssistantId: "asst-a",
          initialSubagentsEnabled: false,
          initialSubagentIds: ["sub-b"],
        },
        services: {
          supportsVision: true,
          supportsTools: true,
          hasNoModels: false,
          modelId: "gpt-4o",
          skills: [],
          knowledgebases: [],
          handleApiError: vi.fn(),
        } as any,
        input: "edited message",
        setInput: vi.fn(),
        textareaRef,
        canMentionAssistant: true,
      }),
    );

    expect(result.current.selections.subagentsEnabled).toBe(false);
    expect(result.current.selections.selectedSubagentIds).toEqual(["sub-b"]);

    act(() => {
      result.current.mentions.setSelectedAssistant(agentD);
    });
    expect(result.current.selections.subagentsEnabled).toBe(true);
    expect(result.current.selections.selectedSubagentIds).toEqual(["sub-e"]);

    act(() => {
      result.current.mentions.setSelectedAssistant(undefined);
    });
    expect(result.current.selections.subagentsEnabled).toBe(true);
  });

  it("handles toggleTool, handleBulkSelect, KB toggles/removals, and skill toggles/mentions", () => {
    const onKnowledgebaseChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useChatInputSelections({
        chatId: "chat-sel-1",
        initialSelectedServerIds: [],
        initialSelectedTools: [],
        initialSelectedKbs: ["kb-1"],
        initialSelectedSkillIds: [],
        initialSubagentsEnabled: false,
        onKnowledgebaseChange,
      }),
    );

    // toggleTool (add & remove)
    act(() => {
      result.current.toggleTool("srv1", "search");
    });
    expect(result.current.selectedTools.has("srv1:tool:search")).toBe(true);
    expect(result.current.selectedServerIds.has("srv1")).toBe(true);

    act(() => {
      result.current.toggleTool("srv1", "search");
    });
    expect(result.current.selectedTools.has("srv1:tool:search")).toBe(false);

    // handleBulkSelect (select=true & select=false)
    act(() => {
      result.current.handleBulkSelect("srv2", ["a", "b"], true);
    });
    expect(result.current.selectedTools.has("srv2:tool:a")).toBe(true);
    act(() => {
      result.current.handleBulkSelect("srv2", ["a", "b"], false);
    });
    expect(result.current.selectedTools.has("srv2:tool:a")).toBe(false);

    // handleToggleKb (remove existing, add new), handleRemoveKb, addKbById (duplicate)
    act(() => {
      result.current.handleToggleKb("kb-1");
      result.current.handleToggleKb("kb-2");
      result.current.handleRemoveKb("kb-2");
      result.current.onMentionKb({ id: "kb-3" });
      result.current.onMentionKb({ id: "kb-3" });
    });
    expect(result.current.selectedKbs.has("kb-3")).toBe(true);
    expect(onKnowledgebaseChange).toHaveBeenCalled();

    // handleToggleSkill, handleRemoveSkill, onMentionSkill
    act(() => {
      result.current.handleToggleSkill("sk-1");
      result.current.handleRemoveSkill("sk-1");
      result.current.onMentionSkill({ id: "sk-2" });
    });
    expect(result.current.selectedSkills.has("sk-2")).toBe(true);

    unmount();
  });

  it("preserves persisted tools when seed keys change and handles approvalMode without chatId", () => {
    const { result, rerender } = renderHook(
      ({ initialTools, initialServerIds, initialSubagentIds, chatId, initialApprovalMode }: any) =>
        useChatInputSelections({
          chatId,
          initialSelectedTools: initialTools,
          initialSelectedServerIds: initialServerIds,
          initialSubagentIds,
          initialApprovalMode,
        }),
      {
        initialProps: {
          chatId: "chat-persist" as string | undefined,
          initialTools: ["srv:tool:b"],
          initialServerIds: ["srv"],
          initialSubagentIds: ["sub-1"] as string[] | undefined,
          initialApprovalMode: "auto" as "ask" | "auto" | undefined,
        },
      },
    );

    rerender({
      chatId: "chat-persist",
      initialTools: ["srv:tool:c"],
      initialServerIds: ["srv2"],
      initialSubagentIds: undefined,
      initialApprovalMode: "ask",
    });

    expect(result.current.selectedTools.has("srv:tool:c")).toBe(true);

    rerender({
      chatId: undefined,
      initialTools: undefined,
      initialServerIds: [],
      initialSubagentIds: undefined,
      initialApprovalMode: undefined,
    });

    act(() => {
      result.current.toggleApprovalMode();
      result.current.toggleApprovalMode();
      result.current.toggleTool("srv", "a");
      result.current.handleBulkSelect("srv", ["a", "b"], true);
    });
  });

  it("does not overwrite persistedTools when initialTools or initialServerIds change", () => {
    useChatToolsStore.getState().setChatTools("chat-persisted-2", ["srv:tool:saved"]);
    const { result, rerender } = renderHook(
      (props: { initialTools?: string[]; initialServerIds?: string[] }) =>
        useChatInputSelections({
          ...baseProps,
          chatId: "chat-persisted-2",
          initialTools: props.initialTools,
          initialServerIds: props.initialServerIds,
        }),
      {
        initialProps: {
          initialTools: ["srv:tool:a"],
          initialServerIds: ["srv"],
        },
      },
    );

    rerender({
      initialTools: ["srv:tool:b"],
      initialServerIds: ["srv2"],
    });

    expect(result.current.selectedTools.has("srv:tool:saved")).toBe(true);
  });
});
