import { describe, expect, it } from "vitest";
import { KB_CONFIG, KB_IMAGE_CONFIG } from "@/config/knowledgebase";

describe("config/knowledgebase", () => {
  it("defines accepted extensions, mime types, and size limits", () => {
    expect(KB_CONFIG.ACCEPTED_EXTENSIONS).toBe(
      ".pdf,.txt,.md,.png,.jpg,.jpeg,.webp",
    );
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("text/plain")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("text/markdown")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);
    expect(KB_CONFIG.ALLOWED_MIME_TYPES.has("application/zip")).toBe(false);
    expect(KB_CONFIG.MAX_FILE_SIZE_MB).toBe(50);
    expect(KB_CONFIG.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("defines image extraction configuration limits", () => {
    expect(KB_IMAGE_CONFIG.MIN_IMAGE_DIMENSION).toBe(100);
    expect(KB_IMAGE_CONFIG.MAX_IMAGE_DIMENSION).toBe(2048);
    expect(KB_IMAGE_CONFIG.MAX_IMAGES_PER_DOC).toBe(50);
  });
});
