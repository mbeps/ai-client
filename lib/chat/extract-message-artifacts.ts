import { extractArtifactFromToolResult } from "@/lib/chat/extract-artifact-from-tool-result";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Appends an artifact if its ID has not been encountered yet.
 */
function appendArtifact(
  artifacts: ArtifactData[],
  seenIds: Set<string>,
  art: ArtifactData,
  messageId: string,
): void {
  const id = art.id;
  if (!seenIds.has(id)) {
    seenIds.add(id);
    artifacts.push({ ...art, id, messageId });
  }
}

/**
 * Collects artifacts stored within persisted message metadata toolResults.
 */
function collectPersistedArtifacts(
  message: Message,
  artifacts: ArtifactData[],
  seenIds: Set<string>,
): void {
  if (!message.metadata) return;

  try {
    const meta =
      typeof message.metadata === "string"
        ? JSON.parse(message.metadata)
        : message.metadata;

    if (!Array.isArray(meta?.toolResults)) return;

    for (const tr of meta.toolResults) {
      const art = extractArtifactFromToolResult(tr);
      if (art) {
        appendArtifact(artifacts, seenIds, art, message.id);
      }
    }
  } catch {
    // Ignore metadata parse errors
  }
}

/**
 * Collects artifacts from in-flight streaming manage_artifact tool calls.
 */
function collectStreamingArtifacts(
  message: Message,
  activeToolCalls: ToolCallState[] | undefined,
  artifacts: ArtifactData[],
  seenIds: Set<string>,
): void {
  if (!activeToolCalls || activeToolCalls.length === 0) return;

  for (const tc of activeToolCalls) {
    if (tc.toolName !== "manage_artifact" || !tc.result) continue;

    const art = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      toolCallId: tc.toolCallId,
      result: tc.result,
    });
    if (art) {
      appendArtifact(artifacts, seenIds, art, message.id);
    }
  }
}

/**
 * Collects standalone Mermaid diagrams from message markdown content.
 */
function collectMermaidArtifacts(
  message: Message,
  artifacts: ArtifactData[],
  seenIds: Set<string>,
): void {
  if (!message.content) return;

  const mermaidMatches = [
    ...message.content.matchAll(/```mermaid\s*\n([\s\S]*?)```/g),
  ];

  mermaidMatches.forEach((m, i) => {
    const content = m[1].trim();
    const id = `${message.id}-mermaid-${i}`;
    // Avoid duplicate if already extracted by manage_artifact with same content
    const alreadyHasContent = artifacts.some(
      (a) => a.content.trim() === content,
    );
    if (!alreadyHasContent && !seenIds.has(id)) {
      seenIds.add(id);
      artifacts.push({
        id,
        type: "mermaid",
        title: i === 0 ? "Mermaid Diagram" : `Mermaid Diagram ${i + 1}`,
        content,
        messageId: message.id,
      });
    }
  });
}

/**
 * Extracts all canvas/artifact items associated with an assistant message.
 * Inspects persisted metadata `toolResults`, in-flight `activeToolCalls`,
 * and embedded Mermaid diagram codeblocks.
 *
 * @param message - The chat message to inspect.
 * @param activeToolCalls - Optional real-time tool calls for streaming responses.
 * @returns Array of normalized `ArtifactData` objects.
 * @author Maruf Bepary
 */
export function extractMessageArtifacts(
  message: Message,
  activeToolCalls?: ToolCallState[],
): ArtifactData[] {
  if (message.role === "user") {
    return [];
  }

  const artifacts: ArtifactData[] = [];
  const seenIds = new Set<string>();

  collectPersistedArtifacts(message, artifacts, seenIds);
  collectStreamingArtifacts(message, activeToolCalls, artifacts, seenIds);
  collectMermaidArtifacts(message, artifacts, seenIds);

  return artifacts;
}
