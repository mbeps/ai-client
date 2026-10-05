import { extractArtifactFromToolResult } from "@/lib/chat/extract-artifact-from-tool-result";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

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

  // 1. Extract from persisted metadata toolResults
  if (message.metadata) {
    try {
      const meta =
        typeof message.metadata === "string"
          ? JSON.parse(message.metadata)
          : message.metadata;

      if (Array.isArray(meta?.toolResults)) {
        for (const tr of meta.toolResults) {
          const art = extractArtifactFromToolResult(tr);
          if (art) {
            const id = art.id || `${message.id}-art-${artifacts.length}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              artifacts.push({ ...art, id, messageId: message.id });
            }
          }
        }
      }
    } catch {
      // Ignore metadata parse errors
    }
  }

  // 2. Extract from active streaming tool calls
  if (activeToolCalls && activeToolCalls.length > 0) {
    for (const tc of activeToolCalls) {
      if (tc.toolName !== "manage_artifact") continue;

      if (tc.result) {
        const art = extractArtifactFromToolResult({
          toolName: "manage_artifact",
          toolCallId: tc.toolCallId,
          result: tc.result,
        });
        if (art) {
          const id = art.id || `${message.id}-art-${artifacts.length}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            artifacts.push({ ...art, id, messageId: message.id });
          }
        }
      }
    }
  }

  // 3. Extract from Mermaid markdown code blocks
  if (message.content) {
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

  return artifacts;
}
