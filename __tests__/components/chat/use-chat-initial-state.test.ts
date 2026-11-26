import { describe, expect, it } from "vitest";
import { resolveInitialChatConfig } from "@/components/chat/use-chat-initial-state";
import { LINKABLE_BUILT_IN_AGENT_IDS } from "@/config/built-in-agents";
import type { Agent } from "@/types/agent/agent";
import type { Chat } from "@/types/chat/chat";
import type { Project } from "@/types/project/project";

describe("resolveInitialChatConfig", () => {
  const baseChat = {
    id: "chat-1",
    title: "Test Chat",
    messages: {},
    currentLeafId: null,
    createdAt: 0,
    updatedAt: 0,
    knowledgebaseId: null,
  } as unknown as Chat;

  const baseAgent = {
    id: "agent-1",
    name: "Researcher",
    description: "Test",
    prompt: "Prompt",
    tools: [],
    knowledgebaseIds: ["kb-agent-1", "kb-agent-2"],
  } as unknown as Agent;

  const baseProject = {
    id: "proj-1",
    name: "Project",
    knowledgebaseId: "kb-proj-1",
    tools: [],
  } as unknown as Project;

  it("includes agent knowledgebaseIds when chat has no knowledgebaseId", () => {
    const result = resolveInitialChatConfig(
      [],
      undefined,
      baseAgent,
      null,
      baseChat,
    );

    expect(result.initialKbIds).toEqual(["kb-agent-1", "kb-agent-2"]);
  });

  it("combines project knowledgebaseId and agent knowledgebaseIds without duplicates", () => {
    const result = resolveInitialChatConfig(
      [],
      baseProject,
      {
        ...baseAgent,
        knowledgebaseIds: ["kb-proj-1", "kb-agent-2"],
      },
      null,
      baseChat,
    );

    expect(result.initialKbIds).toEqual(["kb-proj-1", "kb-agent-2"]);
  });

  it("prefers chat knowledgebaseId over project knowledgebaseId while keeping agent knowledgebaseIds", () => {
    const result = resolveInitialChatConfig(
      [],
      baseProject,
      baseAgent,
      null,
      { ...baseChat, knowledgebaseId: "kb-chat-1" },
    );

    expect(result.initialKbIds).toEqual([
      "kb-chat-1",
      "kb-agent-1",
      "kb-agent-2",
    ]);
  });

  it("auto-enables subagents when assistant or project has subagentIds and thread has no explicit user toggle", () => {
    const orchestratorAgent = {
      ...baseAgent,
      subagentIds: ["sub-1", "sub-2"],
    } as unknown as Agent;

    const fromAgent = resolveInitialChatConfig(
      [],
      undefined,
      orchestratorAgent,
      null,
      baseChat,
    );
    expect(fromAgent.initialSubagentsEnabled).toBe(true);

    const orchestratorProject = {
      ...baseProject,
      subagentIds: ["sub-proj-1"],
    } as unknown as Project;

    const fromProject = resolveInitialChatConfig(
      [],
      orchestratorProject,
      undefined,
      null,
      baseChat,
    );
    expect(fromProject.initialSubagentsEnabled).toBe(true);
  });

  it("respects explicit user toggle in last user message metadata over entity subagentIds", () => {
    const orchestratorAgent = {
      ...baseAgent,
      subagentIds: ["sub-1"],
    } as unknown as Agent;

    const threadWithToggleOff = [
      {
        id: "m1",
        role: "user",
        content: "Hi",
        metadata: JSON.stringify({
          subagentsEnabled: false,
          subagentModelId: "gpt-4o-mini",
        }),
      },
    ] as any;

    const resultOff = resolveInitialChatConfig(
      threadWithToggleOff,
      undefined,
      orchestratorAgent,
      null,
      baseChat,
    );
    expect(resultOff.initialSubagentsEnabled).toBe(false);
    expect(resultOff.initialSubagentModelId).toBe("gpt-4o-mini");

    const threadWithoutSubagentMeta = [
      {
        id: "m2",
        role: "user",
        content: "Hi",
        metadata: JSON.stringify({ model: "gpt-4o" }),
      },
    ] as any;

    const resultFallback = resolveInitialChatConfig(
      threadWithoutSubagentMeta,
      undefined,
      orchestratorAgent,
      null,
      baseChat,
    );
    expect(resultFallback.initialSubagentsEnabled).toBe(true);
  });

  it("defaults initialSubagentIds to LINKABLE_BUILT_IN_AGENT_IDS when no thread, assistant, or project subagents are set", () => {
    const result = resolveInitialChatConfig(
      [],
      baseProject,
      baseAgent,
      null,
      baseChat,
    );

    expect(result.initialSubagentIds).toEqual([...LINKABLE_BUILT_IN_AGENT_IDS]);
  });

  it("resolves initialSubagentIds with precedence: thread metadata -> assistant -> project -> LINKABLE_BUILT_IN_AGENT_IDS", () => {
    const projectWithSubs = {
      ...baseProject,
      subagentIds: ["proj-sub-1"],
    } as unknown as Project;

    const assistantWithSubs = {
      ...baseAgent,
      subagentIds: ["asst-sub-1", "asst-sub-2"],
    } as unknown as Agent;

    const fromProject = resolveInitialChatConfig(
      [],
      projectWithSubs,
      baseAgent,
      null,
      baseChat,
    );
    expect(fromProject.initialSubagentIds).toEqual(["proj-sub-1"]);

    const fromAssistant = resolveInitialChatConfig(
      [],
      projectWithSubs,
      assistantWithSubs,
      null,
      baseChat,
    );
    expect(fromAssistant.initialSubagentIds).toEqual([
      "asst-sub-1",
      "asst-sub-2",
    ]);

    const threadWithSubagentIds = [
      {
        id: "m-sub-1",
        role: "user",
        content: "Hi",
        metadata: JSON.stringify({
          subagentsEnabled: true,
          subagentIds: ["builtin:researcher", "custom-sub-1"],
        }),
      },
    ] as any;

    const fromThread = resolveInitialChatConfig(
      threadWithSubagentIds,
      projectWithSubs,
      assistantWithSubs,
      null,
      baseChat,
    );
    expect(fromThread.initialSubagentIds).toEqual([
      "builtin:researcher",
      "custom-sub-1",
    ]);

    const threadWithEmptySubagentIds = [
      {
        id: "m-sub-empty",
        role: "user",
        content: "Hi",
        metadata: JSON.stringify({
          subagentsEnabled: true,
          subagentIds: [],
        }),
      },
    ] as any;

    const fromEmptyThread = resolveInitialChatConfig(
      threadWithEmptySubagentIds,
      projectWithSubs,
      assistantWithSubs,
      null,
      baseChat,
    );
    expect(fromEmptyThread.initialSubagentIds).toEqual([]);
  });

  it("resolves initialApprovalMode from thread metadata, falling back to userSettings.defaultAutoApprove or ask", () => {
    const defaultAsk = resolveInitialChatConfig(
      [],
      undefined,
      undefined,
      null,
      baseChat,
    );
    expect(defaultAsk.initialApprovalMode).toBe("ask");

    const defaultAuto = resolveInitialChatConfig(
      [],
      undefined,
      undefined,
      { defaultAutoApprove: true } as any,
      baseChat,
    );
    expect(defaultAuto.initialApprovalMode).toBe("auto");

    const threadOverrideAsk = [
      {
        id: "m-app-1",
        role: "user",
        content: "Hi",
        metadata: JSON.stringify({ approvalMode: "ask" }),
      },
    ] as any;
    const overridden = resolveInitialChatConfig(
      threadOverrideAsk,
      undefined,
      undefined,
      { defaultAutoApprove: true } as any,
      baseChat,
    );
    expect(overridden.initialApprovalMode).toBe("ask");
  });

  it("resolves initialModelId from project or assistant defaultChatModelId and handles undefined skillIds", () => {
    const fromProject = resolveInitialChatConfig(
      [],
      { id: "p1", defaultChatModelId: "proj-model", skillMode: "specific" } as any,
      undefined,
      null,
      baseChat,
    );
    expect(fromProject.initialModelId).toBe("proj-model");
    expect(fromProject.initialSkillIds).toEqual([]);

    const fromAssistant = resolveInitialChatConfig(
      [],
      undefined,
      { id: "a1", defaultChatModelId: "asst-model", skillMode: "specific" } as any,
      null,
      baseChat,
    );
    expect(fromAssistant.initialModelId).toBe("asst-model");
    expect(fromAssistant.initialSkillIds).toEqual([]);
  });
});
