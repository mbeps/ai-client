import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useChatInputSelections } from "@/components/chat/input/use-chat-input-selections";
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
});
