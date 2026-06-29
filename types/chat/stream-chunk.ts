/**
 * Represents a single event chunk produced by the AI stream.
 * This is a discriminated union of possible stream updates from the Vercel AI SDK,
 * used to decouple the raw stream from the internal handler logic.
 *
 * @author Maruf Bepary
 */
export type StreamChunk =
  /** A fragment of generated text content. */
  | { type: "text-delta"; text: string }
  /** A request to execute a specific tool with input arguments. */
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  /** The output result from an executed tool. */
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  /** A fragment of reasoning or chain-of-thought text. */
  | { type: "reasoning-delta"; text: string }
  /** An error encountered during the streaming process. */
  | { type: "error"; error: unknown };
