import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) =>
    selector({
      prompts: [],
      mcpServers: [],
      skills: [],
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
    isFirst: true,
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
});
