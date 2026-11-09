import { describe, expect, it } from "vitest";
import {
  resolveInitialChatConfig,
  resolveInitialReasoningEffort,
} from "@/components/chat/use-chat-initial-state";
import { DEFAULT_ENABLED_TOOLS, INTERNAL_TOOL_IDS } from "@/config/tools";
import type { Assistant } from "@/types/assistant/assistant";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";

describe("resolveInitialChatConfig - tools resolution", () => {
  it("resolves DEFAULT_ENABLED_TOOLS when no assistant or project is present", () => {
    const config = resolveInitialChatConfig([], undefined, undefined, null, undefined);
    expect(config.initialSelectedTools).toEqual([...DEFAULT_ENABLED_TOOLS]);
    expect(config.initialServerIds).toEqual([]);
  });

  it("honors empty tools when an assistant has explicitly configured tools as empty array", () => {
    const assistant: Assistant = {
      id: "asst-1",
      userId: "user-1",
      name: "Markdown Converter",
      description: "Converts text into markdown",
      prompt: "Be brief",
      tools: [], // All tools disabled, including canvas!
      skillMode: "dynamic",
      skillIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = resolveInitialChatConfig([], undefined, assistant, null, undefined);
    expect(config.initialSelectedTools).toEqual([]);
    expect(config.initialSelectedTools).not.toContain(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
    expect(config.initialServerIds).toEqual([]);
  });

  it("honors custom tools when assistant has selected specific tools without canvas", () => {
    const assistant: Assistant = {
      id: "asst-2",
      userId: "user-1",
      name: "Excel Assistant",
      description: "Handles spreadsheets",
      prompt: "Help with excel",
      tools: ["excel-server:tool:read_sheet"],
      skillMode: "dynamic",
      skillIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = resolveInitialChatConfig([], undefined, assistant, null, undefined);
    expect(config.initialSelectedTools).toEqual(["excel-server:tool:read_sheet"]);
    expect(config.initialSelectedTools).not.toContain(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
    expect(config.initialServerIds).toEqual(["excel-server"]);
  });

  it("honors empty tools when a project has explicitly configured tools as empty array", () => {
    const project: Project = {
      id: "proj-1",
      userId: "user-1",
      name: "No-tools Project",
      description: null,
      globalPrompt: null,
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = resolveInitialChatConfig([], project, undefined, null, undefined);
    expect(config.initialSelectedTools).toEqual([]);
    expect(config.initialServerIds).toEqual([]);
  });

  it("prefers assistant tools over project tools when both are present", () => {
    const project: Project = {
      id: "proj-1",
      userId: "user-1",
      name: "Project with Canvas",
      description: null,
      globalPrompt: null,
      tools: [INTERNAL_TOOL_IDS.MANAGE_ARTIFACT],
      skillMode: "dynamic",
      skillIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const assistant: Assistant = {
      id: "asst-1",
      userId: "user-1",
      name: "Assistant without Canvas",
      description: "",
      prompt: "",
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = resolveInitialChatConfig([], project, assistant, null, undefined);
    expect(config.initialSelectedTools).toEqual([]);
    expect(config.initialReasoningEffort).toBe("medium");
  });

  it("resolves reasoning effort from thread last user message", () => {
    const thread: Message[] = [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "First turn",
        parentId: null,
        metadata: JSON.stringify({ reasoningEffort: "high" }),
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "msg-2",
        chatId: "chat-1",
        role: "assistant",
        content: "Response 1",
        parentId: "msg-1",
        metadata: null,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    expect(resolveInitialReasoningEffort(thread)).toBe("high");
    const config = resolveInitialChatConfig(thread, undefined, undefined, null, undefined);
    expect(config.initialReasoningEffort).toBe("high");
  });

  it("defaults reasoning effort to medium when no user message contains it", () => {
    const thread: Message[] = [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Hello",
        parentId: null,
        metadata: JSON.stringify({ model: "gpt-4o" }),
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    expect(resolveInitialReasoningEffort(thread)).toBe("medium");
  });
});
