import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatArtifactPanel } from "@/components/chat/use-chat-artifact-panel";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";

describe("useChatArtifactPanel", () => {
  const createArtifactMessage = (
    id: string,
    artifactId: string,
    title: string,
  ): Message => ({
    id,
    chatId: "chat-1",
    role: "assistant",
    content: "Content",
    parentId: null,
    childrenIds: [],
    createdAt: new Date(),
    metadata: JSON.stringify({
      toolResults: [
        {
          toolName: "manage_artifact",
          toolCallId: `tc-${artifactId}`,
          result: {
            artifact: {
              id: artifactId,
              type: "markdown",
              title,
              content: `# ${title}`,
            },
          },
        },
      ],
    }),
  });

  it("initializes with closed state when no artifacts are present", () => {
    const updateMessageMetadataDb = vi.fn();
    const { result } = renderHook(() =>
      useChatArtifactPanel(
        "chat-1",
        undefined,
        [],
        [],
        null,
        updateMessageMetadataDb,
      ),
    );

    expect(result.current.isArtifactOpen).toBe(false);
    expect(result.current.artifactIndex).toBe(-1);
    expect(result.current.allArtifacts).toEqual([]);
    expect(result.current.activeArtifact).toBeNull();
  });

  it("automatically opens when artifacts appear in thread", () => {
    const updateMessageMetadataDb = vi.fn();
    const msg = createArtifactMessage("msg-1", "art-1", "Doc 1");
    const chat: Chat = {
      id: "chat-1",
      userId: "u-1",
      title: "Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg },
    };

    const { result } = renderHook(() =>
      useChatArtifactPanel(
        "chat-1",
        chat,
        [msg],
        [],
        null,
        updateMessageMetadataDb,
      ),
    );

    expect(result.current.isArtifactOpen).toBe(true);
    expect(result.current.artifactIndex).toBe(0);
    expect(result.current.activeArtifact?.id).toBe("art-1");
  });

  it("toggles artifact open and closed", () => {
    const updateMessageMetadataDb = vi.fn();
    const msg = createArtifactMessage("msg-1", "art-1", "Doc 1");
    const chat: Chat = {
      id: "chat-1",
      userId: "u-1",
      title: "Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg },
    };

    const { result } = renderHook(() =>
      useChatArtifactPanel(
        "chat-1",
        chat,
        [msg],
        [],
        null,
        updateMessageMetadataDb,
      ),
    );

    const artifact = result.current.allArtifacts[0];

    // Toggle closed
    act(() => {
      result.current.handleToggleArtifact(artifact);
    });
    expect(result.current.isArtifactOpen).toBe(false);

    // Toggle open
    act(() => {
      result.current.handleToggleArtifact(artifact);
    });
    expect(result.current.isArtifactOpen).toBe(true);
  });

  it("reopens canvas with last artifact via handleReopen", () => {
    const updateMessageMetadataDb = vi.fn();
    const msg = createArtifactMessage("msg-1", "art-1", "Doc 1");
    const chat: Chat = {
      id: "chat-1",
      userId: "u-1",
      title: "Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg },
    };

    const { result } = renderHook(() =>
      useChatArtifactPanel(
        "chat-1",
        chat,
        [msg],
        [],
        null,
        updateMessageMetadataDb,
      ),
    );

    act(() => {
      result.current.setIsArtifactOpen(false);
      result.current.setArtifactIndex(-1);
    });
    expect(result.current.isArtifactOpen).toBe(false);

    act(() => {
      result.current.handleReopen();
    });
    expect(result.current.isArtifactOpen).toBe(true);
    expect(result.current.artifactIndex).toBe(0);
  });

  it("updates artifact content in message metadata via updateMessageMetadataDb", () => {
    const updateMessageMetadataDb = vi.fn();
    const msg = createArtifactMessage("msg-1", "art-1", "Doc 1");
    const chat: Chat = {
      id: "chat-1",
      userId: "u-1",
      title: "Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg },
    };

    const { result } = renderHook(() =>
      useChatArtifactPanel(
        "chat-1",
        chat,
        [msg],
        [],
        null,
        updateMessageMetadataDb,
      ),
    );

    act(() => {
      result.current.handleUpdateArtifact("# Updated Content");
    });

    expect(updateMessageMetadataDb).toHaveBeenCalledTimes(1);
    expect(updateMessageMetadataDb).toHaveBeenCalledWith(
      "chat-1",
      "msg-1",
      expect.stringContaining("# Updated Content"),
    );
  });

  it("handles stringified tool results, invalid JSON, non-matching artifact, and removing all artifacts", () => {
    const updateMessageMetadataDb = vi.fn();
    const msg: Message = {
      id: "msg-1",
      chatId: "chat-1",
      role: "assistant",
      content: "Content",
      parentId: null,
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-bad",
            result: "{invalid-json",
          },
          {
            toolName: "manage_artifact",
            toolCallId: "tc-other",
            result: JSON.stringify({
              artifact: { id: "other-id", type: "markdown", title: "Other", content: "x" },
            }),
          },
          {
            toolName: "manage_artifact",
            toolCallId: "tc-str",
            result: JSON.stringify({
              artifact: { id: "art-str", type: "markdown", title: "Str", content: "# Old" },
            }),
          },
        ],
      }),
    };
    const chat: Chat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg },
    };

    const { result, rerender } = renderHook(
      ({ msgs }) =>
        useChatArtifactPanel(
          "chat-1",
          chat,
          msgs,
          [],
          null,
          updateMessageMetadataDb,
        ),
      { initialProps: { msgs: [msg] } },
    );

    act(() => {
      result.current.handleUpdateArtifact("# New Str");
    });
    expect(updateMessageMetadataDb).toHaveBeenCalledWith(
      "chat-1",
      "msg-1",
      expect.stringContaining("# New Str"),
    );

    // Removing all artifacts closes panel
    rerender({ msgs: [] });
    expect(result.current.isArtifactOpen).toBe(false);

    // handleUpdateArtifact when no activeArtifact
    act(() => {
      result.current.handleUpdateArtifact("# Ignored");
    });
  });
});

