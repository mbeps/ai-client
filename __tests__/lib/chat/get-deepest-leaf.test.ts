import { describe, it, expect } from "vitest";
import { getDeepestLeaf } from "@/lib/chat/message-tree-utils";
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

describe("getDeepestLeaf", () => {
  it("returns the node itself when it has no children", () => {
    const leaf = makeMessage({ id: "leaf" });
    expect(getDeepestLeaf({ leaf }, "leaf")).toBe("leaf");
  });

  it("follows a single child chain to the deepest leaf", () => {
    const a = makeMessage({ id: "a", childrenIds: ["b"] });
    const b = makeMessage({ id: "b", parentId: "a", childrenIds: ["c"] });
    const c = makeMessage({ id: "c", parentId: "b" });
    expect(getDeepestLeaf({ a, b, c }, "a")).toBe("c");
  });

  it("always takes the LAST child at each level", () => {
    const root = makeMessage({ id: "root", childrenIds: ["b1", "b2", "b3"] });
    const b1 = makeMessage({ id: "b1", parentId: "root" });
    const b2 = makeMessage({ id: "b2", parentId: "root" });
    const b3 = makeMessage({ id: "b3", parentId: "root" });
    expect(getDeepestLeaf({ root, b1, b2, b3 }, "root")).toBe("b3");
  });

  it("takes last child recursively down multiple levels", () => {
    const root = makeMessage({ id: "root", childrenIds: ["c1", "c2"] });
    const c1 = makeMessage({ id: "c1", parentId: "root" });
    const c2 = makeMessage({
      id: "c2",
      parentId: "root",
      childrenIds: ["d1", "d2"],
    });
    const d1 = makeMessage({ id: "d1", parentId: "c2" });
    const d2 = makeMessage({ id: "d2", parentId: "c2" });
    expect(getDeepestLeaf({ root, c1, c2, d1, d2 }, "root")).toBe("d2");
  });

  it("returns nodeId unchanged when nodeId is not found in messages", () => {
    // Messages map is empty but we pass a nodeId — the while condition fails immediately
    expect(getDeepestLeaf({}, "unknown")).toBe("unknown");
  });

  it("handles a single-message tree (root with no children)", () => {
    const root = makeMessage({ id: "root" });
    expect(getDeepestLeaf({ root }, "root")).toBe("root");
  });

  it("handles a five-level deep linear chain", () => {
    const ids = ["m1", "m2", "m3", "m4", "m5"];
    const messages: Record<string, Message> = {};
    ids.forEach((id, i) => {
      messages[id] = makeMessage({
        id,
        parentId: i === 0 ? null : ids[i - 1],
        childrenIds: i < ids.length - 1 ? [ids[i + 1]] : [],
      });
    });
    expect(getDeepestLeaf(messages, "m1")).toBe("m5");
  });

  it("can start from a middle node, not just the root", () => {
    const a = makeMessage({ id: "a", childrenIds: ["b"] });
    const b = makeMessage({ id: "b", parentId: "a", childrenIds: ["c"] });
    const c = makeMessage({ id: "c", parentId: "b" });
    // Starting from b, should reach c
    expect(getDeepestLeaf({ a, b, c }, "b")).toBe("c");
  });

  it("stops if a child id references a message not in the map", () => {
    // childrenIds references "ghost" which doesn't exist — loop should exit
    const root = makeMessage({ id: "root", childrenIds: ["ghost"] });
    expect(getDeepestLeaf({ root }, "root")).toBe("ghost");
  });
});
