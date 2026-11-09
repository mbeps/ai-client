import { extractImages, getDocumentProxy } from "unpdf";
import { KB_IMAGE_CONFIG } from "@/config/knowledgebase";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "rag", "extract-images"]);

/**
 * Extracted image metadata and buffer from a PDF document.
 */
export type ExtractedPdfImage = {
  pageNumber: number;
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
};

/**
 * Extracts and filters embedded images from a PDF buffer using unpdf.
 * Discards images smaller than MIN_IMAGE_DIMENSION (100px) or 5KB (icons/decorations).
 * Caps total extracted images at MAX_IMAGES_PER_DOC.
 *
 * @param buffer - Raw PDF buffer or Uint8Array
 * @returns Array of extracted valid images with page numbers and dimensions
 * @author Maruf Bepary
 */
export async function extractImagesFromPdf(
  buffer: Buffer | Uint8Array,
): Promise<ExtractedPdfImage[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted: ExtractedPdfImage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (extracted.length >= KB_IMAGE_CONFIG.MAX_IMAGES_PER_DOC) {
        break;
      }

      const images = await extractImages(pdf, pageNum, { format: "png" });

      for (const img of images) {
        if (extracted.length >= KB_IMAGE_CONFIG.MAX_IMAGES_PER_DOC) {
          break;
        }

        const width = img.width;
        const height = img.height;
        const byteLength = img.data.byteLength;

        // Filter tiny decorative icons, spacers, and sub-5KB noise
        if (
          width < KB_IMAGE_CONFIG.MIN_IMAGE_DIMENSION ||
          height < KB_IMAGE_CONFIG.MIN_IMAGE_DIMENSION ||
          byteLength < 5120
        ) {
          continue;
        }

        extracted.push({
          pageNumber: pageNum,
          buffer: Buffer.from(img.data),
          mimeType: "image/png",
          width,
          height,
        });
      }
    }

    log.debug("Extracted {count} images from PDF", { count: extracted.length });
    return extracted;
  } catch (error) {
    log.error("Failed to extract images from PDF: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
