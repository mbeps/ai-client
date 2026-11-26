import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractServerIdsFromTools } from "@/lib/chat/extract-server-ids-from-tools";
import { resetClientState } from "@/lib/store/reset-client-state";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";

describe("extractServerIdsFromTools", () => {
  it("extracts unique non-internal server ids", () => {
    const tools = [
      "serverA:tool:read",
      "serverA:tool:write",
      "internal:tool:manage_artifact",
      "serverB:tool:search",
    ];
    expect(extractServerIdsFromTools(tools)).toEqual(["serverA", "serverB"]);
  });

  it("returns empty array when no external server tools are present", () => {
    expect(
      extractServerIdsFromTools([
        "internal:tool:manage_artifact",
        "internal:tool:manage_memory",
      ]),
    ).toEqual([]);
    expect(extractServerIdsFromTools([])).toEqual([]);
  });
});

describe("useChatToolsStore", () => {
  beforeEach(() => {
    useChatToolsStore.getState().clearAll();
  });

  it("persists per-chat tools including empty array", () => {
    expect(useChatToolsStore.getState().toolsByChat["chat-1"]).toBeUndefined();

    useChatToolsStore.getState().setChatTools("chat-1", ["serverA:tool:read"]);
    expect(useChatToolsStore.getState().toolsByChat["chat-1"]).toEqual([
      "serverA:tool:read",
    ]);

    // Explicit empty array (all tools disabled) is preserved
    useChatToolsStore.getState().setChatTools("chat-1", []);
    expect(useChatToolsStore.getState().toolsByChat["chat-1"]).toEqual([]);
  });

  it("transfers tools from NEW_CHAT_TOOLS_KEY to new chat id", () => {
    useChatToolsStore
      .getState()
      .setChatTools(NEW_CHAT_TOOLS_KEY, ["serverX:tool:test"]);

    useChatToolsStore
      .getState()
      .transferChatTools(NEW_CHAT_TOOLS_KEY, "chat-created-123");

    expect(
      useChatToolsStore.getState().toolsByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(
      useChatToolsStore.getState().toolsByChat["chat-created-123"],
    ).toEqual(["serverX:tool:test"]);
  });

  it("transferChatTools is a no-op when fromChatId was not customized", () => {
    useChatToolsStore
      .getState()
      .transferChatTools(NEW_CHAT_TOOLS_KEY, "chat-default");

    expect(
      useChatToolsStore.getState().toolsByChat["chat-default"],
    ).toBeUndefined();
  });

  it("clearChatTools is a no-op when chat id was not customized", () => {
    useChatToolsStore.getState().clearChatTools("chat-missing");
    expect(useChatToolsStore.getState().toolsByChat).toEqual({});
  });

  it("clears specific chat tools and clears all", () => {
    useChatToolsStore.getState().setChatTools("chat-1", ["a:tool:1"]);
    useChatToolsStore.getState().setChatTools("chat-2", ["b:tool:2"]);

    useChatToolsStore.getState().clearChatTools("chat-1");
    expect(useChatToolsStore.getState().toolsByChat["chat-1"]).toBeUndefined();
    expect(useChatToolsStore.getState().toolsByChat["chat-2"]).toEqual([
      "b:tool:2",
    ]);

    useChatToolsStore.getState().clearAll();
    expect(useChatToolsStore.getState().toolsByChat).toEqual({});
  });

  it("clears chat tools store on resetClientState", () => {
    useChatToolsStore.getState().setChatTools("chat-1", ["a:tool:1"]);
    resetClientState();
    expect(useChatToolsStore.getState().toolsByChat).toEqual({});
  });

  it("persists, transfers, and clears approvalModeByChat", () => {
    expect(
      useChatToolsStore.getState().approvalModeByChat["chat-1"],
    ).toBeUndefined();

    useChatToolsStore.getState().setChatApprovalMode("chat-1", "auto");
    expect(useChatToolsStore.getState().approvalModeByChat["chat-1"]).toBe(
      "auto",
    );

    useChatToolsStore
      .getState()
      .setChatApprovalMode(NEW_CHAT_TOOLS_KEY, "auto");
    useChatToolsStore
      .getState()
      .transferChatTools(NEW_CHAT_TOOLS_KEY, "chat-new-1");

    expect(
      useChatToolsStore.getState().approvalModeByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(useChatToolsStore.getState().approvalModeByChat["chat-new-1"]).toBe(
      "auto",
    );

    useChatToolsStore.getState().clearChatTools("chat-1");
    expect(
      useChatToolsStore.getState().approvalModeByChat["chat-1"],
    ).toBeUndefined();

    useChatToolsStore.getState().clearAll();
    expect(useChatToolsStore.getState().approvalModeByChat).toEqual({});
  });

  it("does not persist NEW_CHAT_TOOLS_KEY selections to localStorage while persisting real chat ids", () => {
    useChatToolsStore
      .getState()
      .setChatTools(NEW_CHAT_TOOLS_KEY, ["serverX:tool:temp"]);
    useChatToolsStore
      .getState()
      .setChatApprovalMode(NEW_CHAT_TOOLS_KEY, "auto");
    useChatToolsStore.getState().setChatTools("chat-1", ["serverA:tool:read"]);
    useChatToolsStore.getState().setChatApprovalMode("chat-1", "auto");

    const persistedRaw = window.localStorage.getItem("chat-tool-selections");
    expect(persistedRaw).toBeTruthy();
    const parsed = JSON.parse(persistedRaw!);
    expect(parsed.state.toolsByChat[NEW_CHAT_TOOLS_KEY]).toBeUndefined();
    expect(
      parsed.state.approvalModeByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(parsed.state.toolsByChat["chat-1"]).toEqual(["serverA:tool:read"]);
    expect(parsed.state.approvalModeByChat["chat-1"]).toBe("auto");
  });

  it("strips legacy NEW_CHAT_TOOLS_KEY entries from localStorage during rehydration", async () => {
    window.localStorage.setItem(
      "chat-tool-selections",
      JSON.stringify({
        state: {
          toolsByChat: {
            [NEW_CHAT_TOOLS_KEY]: ["srv:tool:stale"],
            "chat-real": ["srv:tool:keep"],
          },
          approvalModeByChat: {
            [NEW_CHAT_TOOLS_KEY]: "auto",
            "chat-real": "ask",
          },
        },
        version: 0,
      }),
    );

    await useChatToolsStore.persist.rehydrate();

    expect(
      useChatToolsStore.getState().toolsByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(
      useChatToolsStore.getState().approvalModeByChat[NEW_CHAT_TOOLS_KEY],
    ).toBeUndefined();
    expect(useChatToolsStore.getState().toolsByChat["chat-real"]).toEqual([
      "srv:tool:keep",
    ]);
    expect(useChatToolsStore.getState().approvalModeByChat["chat-real"]).toBe(
      "ask",
    );
  });

  it("falls back to currentState when persisted toolsByChat and approvalModeByChat are missing", async () => {
    useChatToolsStore.getState().setChatTools("chat-keep", ["srv:tool:1"]);
    useChatToolsStore.getState().setChatApprovalMode("chat-keep", "auto");

    window.localStorage.setItem(
      "chat-tool-selections",
      JSON.stringify({
        state: {},
        version: 0,
      }),
    );

    await useChatToolsStore.persist.rehydrate();

    expect(useChatToolsStore.getState().toolsByChat["chat-keep"]).toEqual([
      "srv:tool:1",
    ]);
    expect(useChatToolsStore.getState().approvalModeByChat["chat-keep"]).toBe(
      "auto",
    );
  });
});

describe("useChatToolsStore SSR fallback", () => {
  it("uses noopStorage when window is undefined", async () => {
    vi.resetModules();
    const windowValue = globalThis.window;
    // Stub window so the persist storage factory falls back to noopStorage,
    // mirroring a server (SSR) render where window does not exist.
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    try {
      const { useChatToolsStore: serverStore } = await import(
        "@/lib/store/use-chat-tools-store"
      );

      // setItem: the persist middleware writes after each state change.
      serverStore.getState().setChatTools("chat-ssr", ["a:tool:1"]);
      expect(serverStore.getState().toolsByChat["chat-ssr"]).toEqual([
        "a:tool:1",
      ]);

      // removeItem: persist clears the noop storage entry.
      serverStore.persist.clearStorage();

      // getItem: rehydration reads noopStorage, which returns null. Run after
      // writes so the rehydrated payload does not mask the other noop methods.
      await serverStore.persist.rehydrate();
      expect(serverStore.getState().toolsByChat["chat-ssr"]).toEqual([
        "a:tool:1",
      ]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: windowValue,
      });
      vi.resetModules();
    }
  });
});
