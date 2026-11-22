import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatApprovalRegistry } from "@/lib/chat/chat-approval-registry";

const MSG_IDS = ["msg-a", "msg-b"];

describe("chatApprovalRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const id of MSG_IDS) chatApprovalRegistry.cancel(id);
  });

  afterEach(() => {
    for (const id of MSG_IDS) chatApprovalRegistry.cancel(id);
  });

  it("waitForDecisions resolves with decision map when resolve is called", async () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1", "app-2"],
      ac.signal,
    );

    expect(chatApprovalRegistry.has("msg-a")).toBe(true);

    const resolved = chatApprovalRegistry.resolve("msg-a", [
      { approvalId: "app-1", approved: true },
      { approvalId: "app-2", approved: false },
    ]);

    expect(resolved).toBe(true);
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);

    const map = await promise;
    expect(map.get("app-1")).toBe(true);
    expect(map.get("app-2")).toBe(false);
  });

  it("resolve returns false when no waiter is registered for the message", () => {
    expect(
      chatApprovalRegistry.resolve("msg-a", [
        { approvalId: "app-1", approved: true },
      ]),
    ).toBe(false);
  });

  it("resolve returns false when decisions omit an expected approvalId", () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1", "app-2"],
      ac.signal,
    );

    const resolved = chatApprovalRegistry.resolve("msg-a", [
      { approvalId: "app-1", approved: true },
    ]);

    expect(resolved).toBe(false);
    expect(chatApprovalRegistry.has("msg-a")).toBe(true);

    // Clean up pending waiter
    chatApprovalRegistry.cancel("msg-a");
    return expect(promise).rejects.toThrow("Approval cancelled");
  });

  it("rejects immediately when abortSignal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort(new Error("Already aborted"));

    await expect(
      chatApprovalRegistry.waitForDecisions("msg-a", ["app-1"], ac.signal),
    ).rejects.toThrow("Already aborted");
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);
  });

  it("rejects with default error when already aborted with a non-Error reason", async () => {
    const ac = new AbortController();
    ac.abort("string-reason");

    await expect(
      chatApprovalRegistry.waitForDecisions("msg-a", ["app-1"], ac.signal),
    ).rejects.toThrow("Approval wait aborted");
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);
  });

  it("rejects and cleans up when abortSignal fires while waiting", async () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1"],
      ac.signal,
    );

    ac.abort(new Error("User stopped stream"));

    await expect(promise).rejects.toThrow("User stopped stream");
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);
  });

  it("rejects with default error when abortSignal fires while waiting with a non-Error reason", async () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1"],
      ac.signal,
    );

    ac.abort("string-reason");

    await expect(promise).rejects.toThrow("Approval wait aborted");
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);
  });

  it("replaces and rejects previous waiter if waitForDecisions is called again for same messageId", async () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    const p1 = chatApprovalRegistry.waitForDecisions("msg-a", ["app-1"], ac1.signal);
    const p2 = chatApprovalRegistry.waitForDecisions("msg-a", ["app-2"], ac2.signal);

    await expect(p1).rejects.toThrow("Superseded by new approval wait");

    chatApprovalRegistry.resolve("msg-a", [{ approvalId: "app-2", approved: true }]);
    const map = await p2;
    expect(map.get("app-2")).toBe(true);
  });

  it("cancel rejects an active waiter and is a no-op when absent", async () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1"],
      ac.signal,
    );

    chatApprovalRegistry.cancel("msg-a");
    await expect(promise).rejects.toThrow("Approval cancelled");
    expect(chatApprovalRegistry.has("msg-a")).toBe(false);

    expect(() => chatApprovalRegistry.cancel("msg-b")).not.toThrow();
  });

  it("removes abort listener on resolve so subsequent abort does not throw", async () => {
    const ac = new AbortController();
    const promise = chatApprovalRegistry.waitForDecisions(
      "msg-a",
      ["app-1"],
      ac.signal,
    );

    chatApprovalRegistry.resolve("msg-a", [{ approvalId: "app-1", approved: true }]);
    await promise;

    expect(() => ac.abort()).not.toThrow();
  });
});
