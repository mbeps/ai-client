import { tool } from "ai";
import { z } from "zod";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

/**
 * Minimal attachment record needed to resolve a file URL on demand.
 * @author Maruf Bepary
 */
export type FileUrlAttachment = {
  name: string;
  key: string;
};

/**
 * Registers an on-demand `get_file_url` tool so the model can fetch a
 * presigned download link for a user-uploaded attachment when it needs one,
 * instead of embedding long-lived signed URLs in the system prompt.
 * Ownership is implicit: records come from the user's own DB-fetched thread.
 *
 * @param attachments - The current thread's attachment records
 * @returns Tools dict containing `get_file_url`
 * @see {@link lib/chat/register-mcp-tools.ts} for registration conventions
 * @author Maruf Bepary
 */
export function registerFileUrlTool(attachments: FileUrlAttachment[]) {
  return {
    get_file_url: tool({
      description:
        "Get a temporary download URL for a file the user uploaded to this conversation. " +
        "Use this when you need a downloadable link for a user-uploaded file, e.g. to pass " +
        "to another tool that fetches files by URL.",
      inputSchema: z.object({
        fileName: z.string().min(1).describe("Exact name of the uploaded file"),
      }),
      execute: async ({ fileName }) => {
        const att = attachments.find((a) => a.name === fileName);
        if (!att) return { error: "File not found" };
        return { url: await getPresignedUrl(att.key) };
      },
    }),
  };
}
