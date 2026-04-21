import z from "zod";
import { isBlockedUrl } from "@/lib/mcp/url-guard";

const jsonArraySchema = z.string().refine(
  (val) => {
    try {
      return Array.isArray(JSON.parse(val));
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON array" },
);

const jsonObjectSchema = z.string().refine(
  (val) => {
    try {
      const p = JSON.parse(val);
      return p !== null && typeof p === "object" && !Array.isArray(p);
    } catch {
      return false;
    }
  },
  { message: "Must be a valid JSON object" },
);

const commandSchema = z
  .string()
  .min(1, "Command is required")
  .refine(
    (val) => {
      if (val.startsWith("/")) return false; // no absolute paths
      const segments = val.split(/[/\\]/);
      return !segments.some((s) => s === ".."); // no path traversal
    },
    {
      message:
        "Command must be a relative path with no path traversal (no absolute paths or ..)",
    },
  );

export const mcpServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    name: z.string().min(1, "Name is required").max(100),
    command: commandSchema,
    args: jsonArraySchema.optional(),
    env: jsonObjectSchema.optional(),
  }),
  z.object({
    type: z.literal("http"),
    name: z.string().min(1, "Name is required").max(100),
    url: z
      .string()
      .url("Invalid URL")
      .refine((val) => !isBlockedUrl(val), {
        message: "URL points to a blocked or internal address",
      }),
    headers: jsonObjectSchema.optional(),
  }),
]);

export const createMcpServerSchema = mcpServerSchema;
export const updateMcpServerSchema = mcpServerSchema;

export type CreateMcpServer = z.infer<typeof mcpServerSchema>;
export type UpdateMcpServer = z.infer<typeof mcpServerSchema>;
