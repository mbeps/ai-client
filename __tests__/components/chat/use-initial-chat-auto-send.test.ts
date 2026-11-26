import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInitialChatAutoSend } from "@/components/chat/use-chat-message-actions";
import type { Chat } from "@/types/chat/chat";

describe("useInitialChatAutoSend", () => {
  const baseChat: Chat = {
    id: "chat-1",
    title: "New Chat",
    messages: {},
    currentLeafId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("defers auto-send until isReady is true and then sends once", () => {
    const onInitialMessageSent = vi.fn();
    const handleSend = vi.fn();

    const { rerender } = renderHook(
      ({ isReady, initialSubagentsEnabled, initialSubagentIds }) =>
        useInitialChatAutoSend(
          baseChat,
          "Hello world",
          onInitialMessageSent,
          handleSend,
          "gpt-4o",
          [],
          [],
          [],
          [],
          initialSubagentsEnabled,
          undefined,
          initialSubagentIds,
          isReady,
          "high",
          "auto",
        ),
      {
        initialProps: {
          isReady: false,
          initialSubagentsEnabled: false,
          initialSubagentIds: ["builtin:researcher"],
        },
      },
    );

    expect(onInitialMessageSent).not.toHaveBeenCalled();
    expect(handleSend).not.toHaveBeenCalled();

    rerender({
      isReady: true,
      initialSubagentsEnabled: true,
      initialSubagentIds: ["sub-custom-1"],
    });

    expect(onInitialMessageSent).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledWith(
      "Hello world",
      [],
      "gpt-4o",
      [],
      [],
      undefined,
      undefined,
      [],
      [],
      true,
      undefined,
      "high",
      ["sub-custom-1"],
      "auto",
    );

    rerender({
      isReady: true,
      initialSubagentsEnabled: false,
      initialSubagentIds: [],
    });
    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it("does not send when initialMessage is undefined", () => {
    const onInitialMessageSent = vi.fn();
    const handleSend = vi.fn();

    renderHook(() =>
      useInitialChatAutoSend(
        baseChat,
        undefined,
        onInitialMessageSent,
        handleSend,
        "gpt-4o",
        [],
        [],
        [],
        undefined,
        false,
        undefined,
        [],
        true,
      ),
    );

    expect(onInitialMessageSent).not.toHaveBeenCalled();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it("defaults initialSkillIds to empty array when undefined", () => {
    const onInitialMessageSent = vi.fn();
    const handleSend = vi.fn();

    renderHook(() =>
      useInitialChatAutoSend(
        baseChat,
        "Hello",
        onInitialMessageSent,
        handleSend,
        "gpt-4o",
        [],
        [],
        [],
        undefined,
        false,
        undefined,
        [],
        true,
      ),
    );

    expect(handleSend).toHaveBeenCalledWith(
      "Hello",
      [],
      "gpt-4o",
      [],
      [],
      undefined,
      undefined,
      [],
      [],
      false,
      undefined,
      undefined,
      [],
      undefined,
    );
  });
});
