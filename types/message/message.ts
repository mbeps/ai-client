import type { Attachment } from "@/types/attachment/attachment";
import { z } from "zod";
import { persistMessageSchema } from "@/schemas/chat";

/**
 * Represents a single node in a branching message tree.
 * Messages can have multiple children (alternative AI responses) and track their parent,
 * enabling users to explore different conversation paths. Stores reasoning tokens
 * from extended-thinking models and attached files (images, documents, spreadsheets).
 *
 * @see Chat for the parent conversation container
 * @see Attachment for file structure
 * @author Maruf Bepary
 */
export type Message = Omit<
  z.infer<typeof persistMessageSchema>,
  "role" | "metadata"
> & {
  /** Sender role: "user" for user messages, "assistant" for AI responses. */
  role: "user" | "assistant";

  /** Timestamp of message creation (immutable after creation). */
  createdAt: Date;

  /**
   * IDs of all direct child messages (alternative responses).
   * Allows branching UI to show multiple response options from a single user message.
   */
  childrenIds: string[];

  /**
   * JSON string storing tool calls and extended-thinking metadata.
   * Parsed by messageMetadataSchema; contains reasoning tokens for streaming responses.
   * Null if no tools or reasoning data is present.
   */
  metadata: string | null;

  /**
   * Extended thinking content from models that support reasoning tokens.
   * Typically collapsed by default in UI and expandable on demand.
   */
  reasoning?: string;

  /**
   * Array of file attachments (images, PDFs, spreadsheets) uploaded with this message.
   * Empty array if no attachments; undefined if not yet loaded from database.
   */
  attachments?: Attachment[];
};
