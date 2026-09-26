import { describe, expect, it } from "vitest";
import { KB_CONFIG } from "@/config/knowledgebase";

describe("config/knowledgebase", () => {
  it("defines accepted extensions, mime types, and size limits", () => {
    expect(KB_CONFIG.ACCEPTED_EXTENSIONS).toBe(".pdf,.txt,.md");
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("text/plain")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("text/markdown")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("image/png")).toBe(false);
    expect(KB_CONFIG.MAX_FILE_SIZE_MB).toBe(50);
    expect(KB_CONFIG.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});
