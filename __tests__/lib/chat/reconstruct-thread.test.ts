import { describe, it, expect } from "vitest";
import { reconstructThread } from "@/lib/chat/message-tree-utils";
import type { Message } from "@/types/message/message";

function makeMessage(partial: Partial<Message> & { id: string }): Message {
  return {
    role: "user",
    content: "hello",
    createdAt: new Date(),
    parentId: null,
    childrenIds: [],
    ...partial,
  };
}

describe("reconstructThread", () => {
  it("returns a single message when it is the only node", () => {
    const msg = makeMessage({ id: "a" });
    const result = reconstructThread({ a: msg }, "a");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("reconstructs a simple two-node chain in order root → leaf", () => {
    const root = makeMessage({ id: "root" });
    const child = makeMessage({ id: "child", parentId: "root" });
    const result = reconstructThread({ root, child }, "child");
    expect(result.map((m) => m.id)).toEqual(["root", "child"]);
  });

  it("reconstructs a three-node chain in correct order", () => {
    const a = makeMessage({ id: "a" });
    const b = makeMessage({ id: "b", parentId: "a" });
    const c = makeMessage({ id: "c", parentId: "b" });
    const result = reconstructThread({ a, b, c }, "c");
    expect(result.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("returns empty array when leafId is not found in messages", () => {
    const result = reconstructThread({}, "nonexistent");
    expect(result).toEqual([]);
  });

  it("stops traversal at a parentId that does not exist in messages", () => {
    // parent points outside the map — should stop at b
    const b = makeMessage({ id: "b", parentId: "missing-root" });
    const result = reconstructThread({ b }, "b");
    expect(result.map((m) => m.id)).toEqual(["b"]);
  });

  it("works correctly on a branching tree — only active branch returned", () => {
    const root = makeMessage({ id: "root", childrenIds: ["b1", "b2"] });
    const b1 = makeMessage({ id: "b1", parentId: "root" });
    const b2 = makeMessage({ id: "b2", parentId: "root" });
    const b2child = makeMessage({ id: "b2child", parentId: "b2" });

    const messages = { root, b1, b2, b2child };

    // Requesting thread for b1 branch
    expect(reconstructThread(messages, "b1").map((m) => m.id)).toEqual([
      "root",
      "b1",
    ]);

    // Requesting thread for b2 → b2child branch
    expect(reconstructThread(messages, "b2child").map((m) => m.id)).toEqual([
      "root",
      "b2",
      "b2child",
    ]);
  });

  it("returns full message objects, not just IDs", () => {
    const msg = makeMessage({
      id: "x",
      content: "test content",
      role: "assistant",
    });
    const result = reconstructThread({ x: msg }, "x");
    expect(result[0]).toMatchObject({
      id: "x",
      content: "test content",
      role: "assistant",
    });
  });

  it("handles a deeply nested chain", () => {
    const ids = ["m1", "m2", "m3", "m4", "m5"];
    const messages: Record<string, Message> = {};
    ids.forEach((id, i) => {
      messages[id] = makeMessage({ id, parentId: i === 0 ? null : ids[i - 1] });
    });
    const result = reconstructThread(messages, "m5");
    expect(result.map((m) => m.id)).toEqual(ids);
  });
});
