import { describe, it, expect } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_SPREADSHEET_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_SPREADSHEET_SIZE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/attachments/constants";

describe("attachment constants", () => {
  describe("ALLOWED_IMAGE_TYPES", () => {
    it("contains image/png", () => {
      expect(ALLOWED_IMAGE_TYPES.has("image/png")).toBe(true);
    });

    it("contains image/jpeg", () => {
      expect(ALLOWED_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    });

    it("contains image/gif", () => {
      expect(ALLOWED_IMAGE_TYPES.has("image/gif")).toBe(true);
    });

    it("contains image/webp", () => {
      expect(ALLOWED_IMAGE_TYPES.has("image/webp")).toBe(true);
    });

    it("does not contain image/bmp", () => {
      expect(ALLOWED_IMAGE_TYPES.has("image/bmp")).toBe(false);
    });
  });

  describe("ALLOWED_DOCUMENT_TYPES", () => {
    it("contains application/pdf", () => {
      expect(ALLOWED_DOCUMENT_TYPES.has("application/pdf")).toBe(true);
    });

    it("contains text/plain", () => {
      expect(ALLOWED_DOCUMENT_TYPES.has("text/plain")).toBe(true);
    });

    it("contains text/markdown", () => {
      expect(ALLOWED_DOCUMENT_TYPES.has("text/markdown")).toBe(true);
    });

    it("does not contain application/msword", () => {
      expect(ALLOWED_DOCUMENT_TYPES.has("application/msword")).toBe(false);
    });
  });

  describe("ALLOWED_SPREADSHEET_TYPES", () => {
    it("contains xlsx MIME type", () => {
      expect(
        ALLOWED_SPREADSHEET_TYPES.has(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe(true);
    });

    it("contains xls MIME type", () => {
      expect(ALLOWED_SPREADSHEET_TYPES.has("application/vnd.ms-excel")).toBe(
        true,
      );
    });

    it("contains text/csv", () => {
      expect(ALLOWED_SPREADSHEET_TYPES.has("text/csv")).toBe(true);
    });

    it("does not contain text/tsv", () => {
      expect(ALLOWED_SPREADSHEET_TYPES.has("text/tsv")).toBe(false);
    });
  });

  describe("size limits", () => {
    it("MAX_IMAGE_SIZE_BYTES is 2 MB", () => {
      expect(MAX_IMAGE_SIZE_BYTES).toBe(2 * 1024 * 1024);
    });

    it("MAX_DOCUMENT_SIZE_BYTES is 20 MB", () => {
      expect(MAX_DOCUMENT_SIZE_BYTES).toBe(20 * 1024 * 1024);
    });

    it("MAX_SPREADSHEET_SIZE_BYTES is 50 MB", () => {
      expect(MAX_SPREADSHEET_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });
  });

  describe("count limits", () => {
    it("MAX_IMAGES_PER_MESSAGE is 3", () => {
      expect(MAX_IMAGES_PER_MESSAGE).toBe(3);
    });

    it("MAX_ATTACHMENTS_PER_MESSAGE is 5", () => {
      expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5);
    });
  });
});
