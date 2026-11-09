import { describe, expect, it, vi } from "vitest";
import { KB_IMAGE_CONFIG } from "@/config/knowledgebase";
import { extractImagesFromPdf } from "@/lib/rag/extract-images-from-pdf";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(),
  extractImages: vi.fn(),
}));

describe("extractImagesFromPdf", () => {
  it("extracts images meeting dimension and size thresholds", async () => {
    const { getDocumentProxy, extractImages } = await import("unpdf");

    vi.mocked(getDocumentProxy).mockResolvedValue({
      numPages: 2,
    } as any);

    const validData = new Uint8Array(6000).fill(1);
    const smallData = new Uint8Array(2000).fill(1);

    vi.mocked(extractImages)
      .mockResolvedValueOnce([
        {
          data: validData,
          width: 300,
          height: 200,
          key: "img1",
          bounds: {} as any,
        },
        {
          data: validData,
          width: 80, // too small
          height: 200,
          key: "icon1",
          bounds: {} as any,
        },
      ])
      .mockResolvedValueOnce([
        {
          data: smallData, // sub-5KB
          width: 400,
          height: 300,
          key: "img2",
          bounds: {} as any,
        },
        {
          data: validData,
          width: 500,
          height: 500,
          key: "img3",
          bounds: {} as any,
        },
      ]);

    const result = await extractImagesFromPdf(Buffer.from("dummy-pdf"));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pageNumber: 1,
      buffer: Buffer.from(validData),
      mimeType: "image/png",
      width: 300,
      height: 200,
    });
    expect(result[1]).toEqual({
      pageNumber: 2,
      buffer: Buffer.from(validData),
      mimeType: "image/png",
      width: 500,
      height: 500,
    });
  });

  it("respects MAX_IMAGES_PER_DOC limit", async () => {
    const { getDocumentProxy, extractImages } = await import("unpdf");

    vi.mocked(getDocumentProxy).mockResolvedValue({
      numPages: 10,
    } as any);

    const validData = new Uint8Array(6000).fill(1);
    const lotsOfImages = Array.from({ length: 60 }, (_, i) => ({
      data: validData,
      width: 200,
      height: 200,
      key: `img_${i}`,
      bounds: {} as any,
    }));

    vi.mocked(extractImages).mockResolvedValue(lotsOfImages);

    const result = await extractImagesFromPdf(Buffer.from("dummy-pdf"));

    expect(result).toHaveLength(KB_IMAGE_CONFIG.MAX_IMAGES_PER_DOC);
  });

  it("breaks early across multiple pages when MAX_IMAGES_PER_DOC is reached", async () => {
    const { getDocumentProxy, extractImages } = await import("unpdf");

    vi.mocked(getDocumentProxy).mockResolvedValue({
      numPages: 5,
    } as any);

    const validData = new Uint8Array(6000).fill(1);
    // Page 1 returns 50 images
    const batch = Array.from({ length: 50 }, (_, i) => ({
      data: validData,
      width: 200,
      height: 200,
      key: `img_${i}`,
      bounds: {} as any,
    }));

    vi.mocked(extractImages).mockResolvedValue(batch);

    const result = await extractImagesFromPdf(Buffer.from("dummy-pdf"));

    expect(result).toHaveLength(50);
    // Should break and not extract page 2
    expect(extractImages).toHaveBeenCalledTimes(1);
  });

  it("handles errors gracefully and returns empty array", async () => {
    const { getDocumentProxy } = await import("unpdf");

    vi.mocked(getDocumentProxy).mockRejectedValueOnce(
      new Error("Corrupt PDF file"),
    );

    const result = await extractImagesFromPdf(Buffer.from("invalid-pdf"));
    expect(result).toEqual([]);
  });

  it("handles non-Error objects thrown gracefully", async () => {
    const { getDocumentProxy } = await import("unpdf");

    vi.mocked(getDocumentProxy).mockRejectedValueOnce("String error");

    const result = await extractImagesFromPdf(Buffer.from("invalid-pdf"));
    expect(result).toEqual([]);
  });
});
