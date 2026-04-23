import { type InferSelectModel } from "drizzle-orm";
import { mcpServer } from "../drizzle/schema";

export type McpServerRow = InferSelectModel<typeof mcpServer>;
