/**
 * Extracts a filename from a URL string, stripping query parameters and hash fragments.
 *
 * @param url - Resource URL to parse.
 * @param fallback - Fallback name if no filename can be parsed.
 * @returns Clean decoded filename.
 */
export function extractFilenameFromUrl(
  url: string,
  fallback = "download",
): string {
  try {
    const parsed = new URL(url, "http://localhost");
    const pathname = parsed.pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // If URL parsing fails, extract from raw string
    const match = url.match(/\/([^/?#]+)(?:[?#]|$)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return fallback;
}

/**
 * Initiates a browser file download without navigating away from the current page.
 * Attempts to fetch as a blob first to force download naming; falls back to an anchor
 * tag targeting a new context if CORS or network policies reject the fetch.
 *
 * @param url - Resource URL to download.
 * @param filename - Optional custom filename for the downloaded file.
 * @author Maruf Bepary
 */
export async function downloadFile(
  url: string,
  filename?: string,
): Promise<void> {
  if (typeof window === "undefined" || !url) return;

  const targetFilename = filename?.trim() || extractFilenameFromUrl(url);

  // If already a blob or data URL, trigger direct anchor download
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    triggerAnchorDownload(url, targetFilename);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    triggerAnchorDownload(objectUrl, targetFilename);
    window.URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback for CORS restricted origins (e.g., direct S3/MinIO signed URLs without CORS)
    triggerAnchorDownload(url, targetFilename, true);
  }
}

/**
 * Triggers an anchor click download.
 *
 * @param href - Download target href.
 * @param filename - Target filename.
 * @param openInNewTab - Whether to open in new tab (used as CORS fallback).
 */
function triggerAnchorDownload(
  href: string,
  filename: string,
  openInNewTab = false,
): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  if (openInNewTab) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
