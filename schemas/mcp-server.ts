import z from "zod";

export const mcpServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    name: z.string().min(1, "Name is required").max(100),
    command: z.string().min(1, "Command is required"),
    args: z.string().optional(),
    env: z.string().optional(),
  }),
  z.object({
    type: z.literal("http"),
    name: z.string().min(1, "Name is required").max(100),
    url: z.string().url("Invalid URL"),
    headers: z.string().optional(),
  }),
]);

export const createMcpServerSchema = mcpServerSchema;
export const updateMcpServerSchema = mcpServerSchema;

export type CreateMcpServer = z.infer<typeof mcpServerSchema>;
export type UpdateMcpServer = z.infer<typeof mcpServerSchema>;
