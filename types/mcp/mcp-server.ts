import { z } from "zod";
import { mcpServerSchema } from "@/schemas/providers/mcp-server";
export type McpServer = z.infer<typeof mcpServerSchema>;
