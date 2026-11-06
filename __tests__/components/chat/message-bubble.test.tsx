import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/message/message";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

// Mock postmark
vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(function () {
    return { sendEmail: vi.fn().mockResolvedValue({}) };
  }),
}));

// Mock auth client
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
      },
    }),
  },
}));

// Mock store
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: any) =>
    selector({
      prompts: [],
      mcpServers: [],
      skills: [],
      assistants: [],
    }),
}));

// Mock useUserModels
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ modelId: "gpt-4o", name: "GPT-4o" }],
    isLoading: false,
  }),
}));

// Mock MarkdownTabEditor
vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="markdown-tab-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { MessageBubble } from "@/components/chat/message-bubble";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_CONFIG } from "@/config/site";

describe("MessageBubble message editing", () => {
  const mockUserMessage: Message = {
    id: "msg-1",
    chatId: "chat-1",
    role: "user",
    content: "Original question for AI",
    parentId: null,
    childrenIds: [],
    createdAt: new Date(),
    metadata: JSON.stringify({
      model: "gpt-4o",
      selectedServerIds: ["server-1"],
      selectedTools: ["tool-1"],
      selectedKbIds: ["kb-1"],
    }),
  };

  const defaultProps = {
    message: mockUserMessage,
    isLatest: true,
    assistantId: null,
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    siblings: [mockUserMessage],
    currentSiblingIndex: 0,
    onNavigateBranch: vi.fn(),
  };

  const renderMessageBubble = (props = {}) =>
    render(
      <TooltipProvider>
        <MessageBubble {...defaultProps} {...props} />
      </TooltipProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user message in view mode initially", () => {
    renderMessageBubble();

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Original question for AI")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("markdown-tab-editor"),
    ).not.toBeInTheDocument();
  });

  it("enters edit mode when clicking edit button and renders MarkdownTabEditor", async () => {
    const user = userEvent.setup();
    renderMessageBubble();

    // Click edit message action button
    const editBtn = screen.getByRole("button", { name: /edit message/i });
    await user.click(editBtn);

    const editor = screen.getByLabelText("markdown-tab-editor");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveValue("Original question for AI");
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save & submit/i }),
    ).toBeInTheDocument();
  });

  it("calls onEdit with updated content and metadata when Save & Submit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMessageBubble({ onEdit });

    const editBtn = screen.getByRole("button", { name: /edit message/i });
    await user.click(editBtn);

    const editor = screen.getByLabelText("markdown-tab-editor");
    fireEvent.change(editor, {
      target: { value: "Updated question with **formatting**" },
    });

    const saveBtn = screen.getByRole("button", { name: /save & submit/i });
    await user.click(saveBtn);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(
      "msg-1",
      "Updated question with **formatting**",
      [],
      "gpt-4o",
      ["server-1"],
      ["tool-1"],
      undefined,
      undefined,
      ["kb-1"],
      [],
      undefined,
      undefined,
    );

    // Exits edit mode
    await waitFor(() => {
      expect(
        screen.queryByLabelText("markdown-tab-editor"),
      ).not.toBeInTheDocument();
    });
  });

  it("cancels edit mode without calling onEdit when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMessageBubble({ onEdit });

    const editBtn = screen.getByRole("button", { name: /edit message/i });
    await user.click(editBtn);

    const editor = screen.getByLabelText("markdown-tab-editor");
    fireEvent.change(editor, {
      target: { value: "Abandoned edits" },
    });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onEdit).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("markdown-tab-editor"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Original question for AI")).toBeInTheDocument();
  });

  it("disables Save & Submit when content is empty and message has no attachments", async () => {
    const user = userEvent.setup();
    renderMessageBubble();

    const editBtn = screen.getByRole("button", { name: /edit message/i });
    await user.click(editBtn);

    const editor = screen.getByLabelText("markdown-tab-editor");
    fireEvent.change(editor, {
      target: { value: "   " },
    });

    const saveBtn = screen.getByRole("button", { name: /save & submit/i });
    expect(saveBtn).toBeDisabled();
  });

  it("renders CanvasCard when assistant message metadata contains manage_artifact tool result", () => {
    const assistantMsgWithArtifact: Message = {
      id: "msg-art-1",
      chatId: "chat-1",
      role: "assistant",
      content: "I have prepared the requested document.",
      parentId: "msg-1",
      childrenIds: [],
      createdAt: new Date("2026-09-26T11:49:00Z"),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-art",
            result: {
              artifact: {
                id: "art-card-1",
                type: "markdown",
                title: "Canvas Absence Notification",
                content: "# Absence Notification",
              },
            },
          },
        ],
      }),
    };

    const onToggleArtifact = vi.fn();

    renderMessageBubble({
      message: assistantMsgWithArtifact,
      onToggleArtifact,
      isCanvasOpen: false,
      activeArtifactId: null,
    });

    expect(screen.getByText("Canvas Absence Notification")).toBeInTheDocument();
    const openBtn = screen.getByRole("button", { name: /^open$/i });
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(onToggleArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "art-card-1",
        title: "Canvas Absence Notification",
      }),
    );
  });

  it("does NOT render CanvasCard for assistant messages without canvas artifacts", () => {
    const plainAssistantMsg: Message = {
      id: "msg-plain-1",
      chatId: "chat-1",
      role: "assistant",
      content: "Hello! How can I help you today?",
      parentId: "msg-1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    renderMessageBubble({
      message: plainAssistantMsg,
    });

    expect(
      screen.queryByRole("button", { name: /^open$/i }),
    ).not.toBeInTheDocument();
  });

  it("renders DownloadCard when assistant message metadata contains downloadable file URL", () => {
    const assistantMsgWithDownload: Message = {
      id: "msg-dl-1",
      chatId: "chat-1",
      role: "assistant",
      content: "I have generated the revenue projections spreadsheet for you.",
      parentId: "msg-1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolCallId: "tc-excel-1",
            toolName: "generate_workbook",
            result: {
              url: "https://minio.local/bucket/q3_revenue.xlsx",
              filename: "q3_revenue.xlsx",
              size: 51200,
            },
          },
        ],
      }),
    };

    renderMessageBubble({
      message: assistantMsgWithDownload,
    });

    expect(screen.getByText("q3_revenue.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Spreadsheet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^download$/i }),
    ).toBeInTheDocument();
  });

  it("renders default assistant name in header instead of model slug for assistant messages", () => {
    const assistantMsg: Message = {
      id: "msg-ai-1",
      chatId: "chat-1",
      role: "assistant",
      content: "Hello! I am an assistant.",
      parentId: "msg-1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        model: "nvidia/nemotron-3.5-lightning:free",
      }),
    };

    renderMessageBubble({
      message: assistantMsg,
    });

    const header = screen.getByTestId("message-header");
    expect(within(header).getByText(SITE_CONFIG.DEFAULT_ASSISTANT_NAME)).toBeInTheDocument();
    expect(within(header).queryByText("nvidia/nemotron-3.5-lightning:free")).not.toBeInTheDocument();
  });

  it("renders assistant name from parent assistant when parent message has assistantId", () => {
    const parentMsgWithAssistant: Message = {
      id: "msg-parent-1",
      chatId: "chat-1",
      role: "user",
      content: "Can you help me write Python?",
      parentId: null,
      childrenIds: ["msg-ai-2"],
      createdAt: new Date(),
      metadata: JSON.stringify({
        assistantId: "asst-python-1",
      }),
    };

    const assistantMsg: Message = {
      id: "msg-ai-2",
      chatId: "chat-1",
      role: "assistant",
      content: "Sure! Here is Python code.",
      parentId: "msg-parent-1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        model: "openai/gpt-4o",
      }),
    };

    const mockAssistants = [
      {
        id: "asst-python-1",
        name: "Python Pro Assistant",
        userId: "user-1",
        description: null,
        prompt: null,
        tools: null,
        skillMode: "dynamic" as const,
        skillIds: [],
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    renderMessageBubble({
      message: assistantMsg,
      parentMessage: parentMsgWithAssistant,
      assistants: mockAssistants,
    });

    const header = screen.getByTestId("message-header");
    expect(within(header).getByText("Python Pro Assistant")).toBeInTheDocument();
    expect(within(header).queryByText("openai/gpt-4o")).not.toBeInTheDocument();
  });

  it("renders assistant name from chat assistantId when no parent message metadata exists", () => {
    const assistantMsg: Message = {
      id: "msg-ai-3",
      chatId: "chat-1",
      role: "assistant",
      content: "Response from chat assistant.",
      parentId: null,
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        model: "anthropic/claude-3-opus",
      }),
    };

    const mockAssistants = [
      {
        id: "asst-chat-1",
        name: "Dedicated Chat Bot",
        userId: "user-1",
        description: null,
        prompt: null,
        tools: null,
        skillMode: "dynamic" as const,
        skillIds: [],
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    renderMessageBubble({
      message: assistantMsg,
      assistantId: "asst-chat-1",
      assistants: mockAssistants,
    });

    const header = screen.getByTestId("message-header");
    expect(within(header).getByText("Dedicated Chat Bot")).toBeInTheDocument();
    expect(within(header).queryByText("anthropic/claude-3-opus")).not.toBeInTheDocument();
  });
});

