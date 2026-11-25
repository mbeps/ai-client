import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";

const mockPush = vi.fn();
const mockCreateChatDb = vi.fn();
const mockSetKnowledgebaseDb = vi.fn();
const mockHydrationCalls: string[][] = [];
let lastChatInputProps: Record<string, any> | null = null;
let mockStoreState: Record<string, any> = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "user-1", name: "Maruf Bepary" } },
    }),
  },
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: (resources: string[]) => {
    mockHydrationCalls.push(resources);
    return { isLoading: false, loadingResources: [] };
  },
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [
      { id: "m-1", modelId: "openrouter/free", name: "Auto" },
      {
        id: "m-2",
        modelId: "nvidia/nemotron-3.5-lightning:free",
        name: "Nemotron",
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: (props: Record<string, any>) => {
    lastChatInputProps = props;
    return (
      <div>
        <button
          type="button"
          data-testid="send-full"
          onClick={() =>
            props.onSend(
              "Give me a list of Java projects",
              [
                {
                  id: "att-1",
                  type: "document",
                  name: "notes.txt",
                  mimeType: "text/plain",
                  sizeBytes: 12,
                  dataUrl: "data:text/plain;base64,aGVsbG8=",
                },
              ],
              "nvidia/nemotron-3.5-lightning:free",
              ["srv-1"],
              ["internal:tool:manage_artifact", "srv-1:tool:list_projects"],
              ["prompt-1"],
              "agent-1",
              ["kb-1", "kb-2"],
              ["skill-1"],
              true,
              "sub-model-1",
              "high",
              ["sub-1"],
              "auto",
            )
          }
        >
          Send Full
        </button>
        <button
          type="button"
          data-testid="send-empty-with-kb"
          onClick={() =>
            props.onSend(
              "   ",
              [],
              "nvidia/nemotron-3.5-lightning:free",
              [],
              [],
              undefined,
              undefined,
              ["kb-1"],
              [],
              false,
              undefined,
              "medium",
              [],
              "ask",
            )
          }
        >
          Send Empty With KB
        </button>
      </div>
    );
  },
}));

import HomePage from "@/app/(main)/page";

describe("HomePage chat launch parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydrationCalls.length = 0;
    lastChatInputProps = null;
    useChatToolsStore.getState().clearAll();
    mockCreateChatDb.mockResolvedValue("chat-new-123");
    mockSetKnowledgebaseDb.mockResolvedValue(undefined);
    mockStoreState = {
      createChatDb: mockCreateChatDb,
      setKnowledgebaseDb: mockSetKnowledgebaseDb,
      mcpServers: [
        { id: "srv-1", name: "Portfolio", enabled: true },
        { id: "srv-2", name: "Disabled", enabled: false },
      ],
      userSettings: {
        defaultChatModelId: "nvidia/nemotron-3.5-lightning:free",
        defaultAutoApprove: true,
      },
    };
  });

  it("hydrates the same resources as ChatUI and seeds default model and approval mode", () => {
    render(<HomePage />);

    expect(mockHydrationCalls[0]).toEqual(
      expect.arrayContaining([
        "mcpServers",
        "publicMcpServers",
        "agents",
        "projects",
        "prompts",
        "skills",
        "mcpPrompts",
        "userSettings",
      ]),
    );
    expect(lastChatInputProps?.initialModelId).toBe(
      "nvidia/nemotron-3.5-lightning:free",
    );
    expect(lastChatInputProps?.initialApprovalMode).toBe("auto");
    expect(lastChatInputProps?.chatId).toBe(NEW_CHAT_TOOLS_KEY);
  });

  it("preserves all 14 onSend parameters in pending launch, updates KB, transfers tools, and navigates", async () => {
    useChatToolsStore
      .getState()
      .setChatTools(NEW_CHAT_TOOLS_KEY, [
        "internal:tool:manage_artifact",
        "srv-1:tool:list_projects",
      ]);
    useChatToolsStore.getState().setChatApprovalMode(NEW_CHAT_TOOLS_KEY, "auto");

    render(<HomePage />);
    fireEvent.click(screen.getByTestId("send-full"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-new-123"));
    });

    expect(mockCreateChatDb).toHaveBeenCalledWith(
      "Give me a list of Java projects",
    );
    expect(mockSetKnowledgebaseDb).toHaveBeenCalledWith("chat-new-123", "kb-1");
    expect(useChatToolsStore.getState().toolsByChat["chat-new-123"]).toEqual([
      "internal:tool:manage_artifact",
      "srv-1:tool:list_projects",
    ]);
    expect(
      useChatToolsStore.getState().approvalModeByChat["chat-new-123"],
    ).toBe("auto");
    expect(
      useChatToolsStore.getState().pendingLaunchByChat["chat-new-123"],
    ).toEqual({
      content: "Give me a list of Java projects",
      attachments: [
        expect.objectContaining({ id: "att-1", name: "notes.txt" }),
      ],
      model: "nvidia/nemotron-3.5-lightning:free",
      selectedServerIds: ["srv-1"],
      selectedTools: [
        "internal:tool:manage_artifact",
        "srv-1:tool:list_projects",
      ],
      selectedPromptId: ["prompt-1"],
      selectedAssistantId: "agent-1",
      selectedKnowledgebases: ["kb-1", "kb-2"],
      selectedSkillIds: ["skill-1"],
      subagentsEnabled: true,
      subagentModelId: "sub-model-1",
      reasoningEffort: "high",
      subagentIds: ["sub-1"],
      approvalMode: "auto",
    });
  });

  it("allows submitting non-text payloads (e.g. KB/attachment/prompt only) with New Chat title fallback", async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByTestId("send-empty-with-kb"));

    await waitFor(() => {
      expect(mockCreateChatDb).toHaveBeenCalledWith("New Chat");
    });

    expect(mockSetKnowledgebaseDb).toHaveBeenCalledWith("chat-new-123", "kb-1");
    expect(mockPush).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-new-123"));
    expect(
      useChatToolsStore.getState().pendingLaunchByChat["chat-new-123"],
    ).toMatchObject({
      content: "   ",
      selectedKnowledgebases: ["kb-1"],
      model: "nvidia/nemotron-3.5-lightning:free",
    });
  });

  it("prevents duplicate chat creation while a launch is in-flight and recovers on error", async () => {
    let rejectCreate!: (err: Error) => void;
    mockCreateChatDb.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );

    render(<HomePage />);
    fireEvent.click(screen.getByTestId("send-full"));
    fireEvent.click(screen.getByTestId("send-full"));

    expect(mockCreateChatDb).toHaveBeenCalledTimes(1);
    expect(lastChatInputProps?.isLoading).toBe(true);

    rejectCreate(new Error("DB error"));
    await waitFor(() => {
      expect(lastChatInputProps?.isLoading).toBe(false);
    });
  });
});
