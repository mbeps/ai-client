/**
 * Checks whether the selected model supports the vision capabilities required by
 * the conversation history.
 *
 * A mismatch occurs when the model does NOT have `capVision` but the messages
 * contain image content (either as attachment `type: "image"` or as a content
 * part with `type: "image"`).
 *
 * @param messages        The conversation history from the chat request
 * @param capVision       Whether the resolved model supports vision
 * @returns `true` when the content is compatible with the model, `false` when
 *          the content requires vision but the model does not support it.
 */
export function checkVisionSupport(
  messages: Array<{
    role: string;
    content?:
      | string
      | Array<{
          type: string;
          text?: string;
          image?: string;
          mimeType?: string;
        }>;
    attachments?: Array<{
      id: string;
      type?: string;
      dataUrl?: string;
      name: string;
      mimeType?: string;
      extractedText?: string;
      key?: string;
    }>;
  }>,
  capVision: boolean,
): boolean {
  if (capVision) return true;

  const hasImages = messages.some(
    (m) =>
      m.attachments?.some((a) => a.type === "image") ||
      (Array.isArray(m.content) && m.content.some((p) => p.type === "image")),
  );

  return !hasImages;
}
