import { describe, expect, it } from "vitest";
import { resolveInitialChatConfig } from "@/components/chat/use-chat-initial-state";
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
});
