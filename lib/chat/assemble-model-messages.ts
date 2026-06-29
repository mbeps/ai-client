import type { ModelMessage } from "ai";

/**
 * Text content part for Vercel AI SDK model messages.
 * @author Maruf Bepary
 */
type TextPart = { type: "text"; text: string };

/**
 * Image content part for Vercel AI SDK model messages.
 * @author Maruf Bepary
 */
type ImagePart = { type: "image"; image: URL | string; mimeType?: string };

/**
 * Chat message from the request, including attachments and metadata.
 * Includes extracted text from documents and data URLs for images.
 * @author Maruf Bepary
 */
type HistoryMessage = {
  role: string;
  content:
    | string
    | Array<{ type: string; text?: string; image?: string; mimeType?: string }>;
  attachments?: Array<{
    id: string;
    type?: string;
    dataUrl?: string;
    name: string;
    mimeType?: string;
    extractedText?: string;
    key?: string;
  }>;
  metadata?: string | null;
};

/**
 * Converts raw chat history into Vercel AI SDK-compatible model messages.
 * Handles complex multimodal content assembly:
 * - Document attachments are converted to text parts with labels
 * - Images are placed after text to maintain token efficiency
 * - Assistant messages with tool calls are reconstructed with proper structure
 * - Tool results are attached as tool-role messages for proper model consumption
 *
 * @param messages - Raw history from chat request
 * @returns Messages formatted for Vercel AI SDK (text, images, tool calls, tool results)
 * @author Maruf Bepary
 */
export function assembleModelMessages(
  messages: HistoryMessage[],
): ModelMessage[] {
  return messages.flatMap((m) => {
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const parts: Array<TextPart | ImagePart> = [];

      for (const att of m.attachments) {
        if (att.type === "document" && att.extractedText) {
          parts.push({
            type: "text",
            text: `[Document: ${att.name}]\n${att.extractedText}`,
          });
        }
      }

      if (typeof m.content === "string" && m.content.trim()) {
        parts.push({ type: "text", text: m.content });
      }

      for (const att of m.attachments) {
        if (att.type === "image" && att.dataUrl) {
          parts.push({
            type: "image",
            image: att.dataUrl,
            mimeType: att.mimeType,
          });
        }
      }

      return [
        {
          role: m.role,
          content:
            parts.length === 1 && parts[0].type === "text"
              ? (parts[0] as TextPart).text
              : parts,
        },
      ];
    }

    if (m.role === "assistant" && m.metadata) {
      try {
        const meta = JSON.parse(m.metadata);
        if (Array.isArray(meta.toolCalls) && meta.toolCalls.length > 0) {
          const parts: any[] = [];
          if (m.content && typeof m.content === "string" && m.content.trim()) {
            parts.push({ type: "text", text: m.content });
          }

          for (const tc of meta.toolCalls) {
            parts.push({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args,
            });
          }

          const msgs: any[] = [{ role: "assistant", content: parts }];

          if (Array.isArray(meta.toolResults) && meta.toolResults.length > 0) {
            const resultParts = meta.toolResults.map((tr: any) => {
              const rawResult =
                typeof tr.result === "string"
                  ? JSON.parse(tr.result)
                  : tr.result;
              return {
                type: "tool-result",
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                output: { type: "json", value: rawResult },
              };
            });
            msgs.push({ role: "tool", content: resultParts });
          }

          return msgs;
        }
      } catch (e) {
        console.warn("[Chat API] Failed to parse metadata for history:", e);
      }
    }

    return [{ role: m.role, content: m.content }];
  }) as ModelMessage[];
}
