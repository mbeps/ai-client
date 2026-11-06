import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";
import type { ArtifactData } from "@/types/artifact/artifact-data";

/**
 * Options for extracting active canvas artifacts from a thread.
 *
 * @author Maruf Bepary
 */
export interface ExtractCanvasArtifactsOptions {
  /** Maximum number of most recent artifacts to return. Defaults to 2. */
  maxArtifacts?: number;
  /** Maximum character length per artifact content before truncation. Defaults to 20,000. */
  maxContentLength?: number;
}

const DEFAULT_MAX_ARTIFACTS = 2;
const DEFAULT_MAX_CONTENT_LENGTH = 20_000;
const TRUNCATION_NOTICE =
  "\n\n[... Canvas content truncated for context window limits ...]";

/**
 * Truncates artifact content if it exceeds the maximum allowed length.
 *
 * @param content - Raw artifact content string
 * @param maxLength - Maximum permitted character count
 * @returns Truncated content with notice or original content
 * @author Maruf Bepary
 */
function truncateCanvasContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + TRUNCATION_NOTICE;
}

/**
 * Extracts and deduplicates the active canvas artifacts from a conversation thread.
 *
 * Walks thread messages in chronological order (root to leaf).
 * Later messages in the branch update existing artifacts with matching IDs, ensuring
 * manual user edits stored in message metadata are accurately captured.
 *
 * @param thread - Chronological branch messages loaded from database
 * @param options - Sizing and truncation constraints
 * @returns Array of the most recent active canvas artifacts
 * @author Maruf Bepary
 */
export function extractThreadCanvasArtifacts(
  thread: ThreadMessage[],
  options: ExtractCanvasArtifactsOptions = {},
): ArtifactData[] {
  if (!thread || thread.length === 0) {
    return [];
  }

  const {
    maxArtifacts = DEFAULT_MAX_ARTIFACTS,
    maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  } = options;

  const artifactMap = new Map<string, ArtifactData>();

  for (const msg of thread) {
    const extracted = extractMessageArtifacts(msg);
    for (const art of extracted) {
      artifactMap.set(art.id, art);
    }
  }

  const artifacts = Array.from(artifactMap.values());
  const recentArtifacts =
    maxArtifacts > 0 ? artifacts.slice(-maxArtifacts) : artifacts;

  return recentArtifacts.map((art) => ({
    ...art,
    content: truncateCanvasContent(art.content, maxContentLength),
  }));
}
