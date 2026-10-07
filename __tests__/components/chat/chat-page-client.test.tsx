import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import type { Chat } from "@/types/chat/chat";

let lastChatUiProps: any = null;

vi.mock("@/components/chat/chat-ui", () => ({
  ChatUI: (props: any) => {
    lastChatUiProps = props;
    return (
      <div data-testid="chat-ui">
        <span>{props.initialMessage ?? "no-initial-message"}</span>
        <button
          type="button"
          data-testid="send-initial-btn"
          onClick={() => props.onInitialMessageSent?.()}
        >
          Mark Initial Sent
        </button>
      </div>
    );
  },
}));

const mockUpsertChat = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector({ upsertChat: mockUpsertChat }),
}));

function createMockChat(id: string, messageCount = 0): Chat {
  const messages: Record<string, any> = {};
  for (let i = 0; i < messageCount; i++) {
    messages[`msg-${i}`] = { id: `msg-${i}`, role: "user", content: "hi" };
  }
  return {
    id,
    title: "Test Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    messages,
  } as unknown as Chat;
}

describe("ChatPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastChatUiProps = null;
    window.history.replaceState({}, "", "/chats/test-chat");
  });

  it("strips ?msg= from URL on mount using window.history.replaceState", () => {
    window.history.replaceState({}, "", "/chats/test-chat?msg=hello%20world");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    render(
      <ChatPageClient
        initialChat={createMockChat("chat-clean-url")}
        initialMessage="hello world"
      />,
    );

    expect(replaceSpy).toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("passes initialMessage to ChatUI when chat is empty and has not been handled", () => {
    render(
      <ChatPageClient
        initialChat={createMockChat("chat-first-mount")}
        initialMessage="First prompt"
      />,
    );

    expect(lastChatUiProps.initialMessage).toBe("First prompt");
  });

  it("does not pass initialMessage if chat already has existing messages", () => {
    render(
      <ChatPageClient
        initialChat={createMockChat("chat-with-messages", 2)}
        initialMessage="Ignored prompt"
      />,
    );

    expect(lastChatUiProps.initialMessage).toBeUndefined();
  });

  it("deduplicates initialMessage on remount after onInitialMessageSent is called", () => {
    const { unmount } = render(
      <ChatPageClient
        initialChat={createMockChat("chat-dedup")}
        initialMessage="Only send once"
      />,
    );

    expect(lastChatUiProps.initialMessage).toBe("Only send once");

    // Simulate ChatUI reporting initial message sent
    act(() => {
      lastChatUiProps.onInitialMessageSent();
    });

    unmount();

    // Remount the same chat (e.g. user navigated back in SPA)
    render(
      <ChatPageClient
        initialChat={createMockChat("chat-dedup")}
        initialMessage="Only send once"
      />,
    );

    expect(lastChatUiProps.initialMessage).toBeUndefined();
  });
});
