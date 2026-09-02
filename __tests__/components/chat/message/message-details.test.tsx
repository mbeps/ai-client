import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageDetails } from "@/components/chat/message/message-details";
import type { ParsedMessageMetadata } from "@/types/message/metadata";

// Mock useIsMobile hook (desktop by default)
vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

describe("MessageDetails component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDate = new Date("2026-09-02T10:30:00Z");

  const fullMetadata: ParsedMessageMetadata = {
    promptMeta: null,
    toolData: null,
    modelId: "claude-3-5-sonnet",
    selectedServerIds: null,
    selectedTools: null,
    selectedKbIds: null,
    reasoning: undefined,
    usage: {
      promptTokens: 150,
      completionTokens: 300,
      totalTokens: 450,
    },
    finishReason: "stop",
    durationMs: 2450,
  };

  it("renders model name and formatted date in trigger line", () => {
    render(<MessageDetails createdAt={mockDate} metadata={fullMetadata} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("claude-3-5-sonnet")).toBeInTheDocument();
    expect(screen.getByText(/Sep 2, 2026/)).toBeInTheDocument();
  });

  it("opens details dialog on click showing all metadata fields", async () => {
    const user = userEvent.setup();
    render(<MessageDetails createdAt={mockDate} metadata={fullMetadata} />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.getByText("Response Details")).toBeInTheDocument();
    expect(screen.getByText("2.5s")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("stop")).toBeInTheDocument();
  });

  it("omits missing fields when rendering old/partial metadata", async () => {
    const user = userEvent.setup();
    const partialMetadata: ParsedMessageMetadata = {
      promptMeta: null,
      toolData: null,
      modelId: "gpt-4",
      selectedServerIds: null,
      selectedTools: null,
      selectedKbIds: null,
      reasoning: undefined,
      usage: null,
      finishReason: null,
      durationMs: null,
    };

    render(<MessageDetails createdAt={mockDate} metadata={partialMetadata} />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.getByText("Response Details")).toBeInTheDocument();
    expect(screen.queryByText("Prompt Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Completion Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Duration")).not.toBeInTheDocument();
    expect(screen.queryByText("Finish Reason")).not.toBeInTheDocument();
  });

  it("renders nothing when neither modelId nor createdAt is available", () => {
    const emptyMetadata: ParsedMessageMetadata = {
      promptMeta: null,
      toolData: null,
      modelId: null,
      selectedServerIds: null,
      selectedTools: null,
      selectedKbIds: null,
      reasoning: undefined,
      usage: null,
      finishReason: null,
      durationMs: null,
    };

    const { container } = render(
      <MessageDetails
        createdAt={null as unknown as Date}
        metadata={emptyMetadata}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
