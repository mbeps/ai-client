import { describe, expect, it } from "vitest";
import { checkVisionSupport } from "@/lib/chat/vision-guard";

describe("checkVisionSupport", () => {
  it("returns true immediately when model supports vision (capVision = true)", () => {
    const messages = [
      {
        role: "user",
        attachments: [{ id: "1", type: "image", name: "photo.jpg" }],
      },
    ];
    expect(checkVisionSupport(messages, true)).toBe(true);
  });

  it("returns true when model does not support vision but messages contain no images", () => {
    const messages = [
      {
        role: "user",
        content: "Hello AI",
        attachments: [{ id: "1", type: "file", name: "doc.pdf" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello user" }],
      },
    ];
    expect(checkVisionSupport(messages, false)).toBe(true);
  });

  it("returns false when model does not support vision and message has image attachment", () => {
    const messages = [
      {
        role: "user",
        attachments: [{ id: "1", type: "image", name: "photo.jpg" }],
      },
    ];
    expect(checkVisionSupport(messages, false)).toBe(false);
  });

  it("returns false when model does not support vision and message content contains image part", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image", image: "data:image/png;base64,..." },
        ],
      },
    ];
    expect(checkVisionSupport(messages, false)).toBe(false);
  });

  it("returns true for empty messages list when capVision is false", () => {
    expect(checkVisionSupport([], false)).toBe(true);
  });
});

