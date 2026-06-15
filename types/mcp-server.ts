import { z } from "zod";
import { mcpServerSchema } from "@/schemas/mcp-server";
export type McpServer = z.infer<typeof mcpServerSchema>;
