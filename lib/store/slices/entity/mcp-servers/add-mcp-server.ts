import { createMcpServer as createMcpServerAction } from "@/lib/mcp/create-mcp-server";
import { CreateMcpServer } from "@/schemas/mcp-server";
import { EntitySet } from "../types";

/**
 * Adds a new MCP server to DB and store.
 * @param set - Store setter.
 */
export const addMcpServer =
  (set: EntitySet) => async (data: CreateMcpServer) => {
    const row = await createMcpServerAction(data);
    set((state) => ({
      mcpServers: [
        {
          id: row.id,
          name: row.name,
          type: row.type,
          command: row.command,
          args: row.args,
          url: row.url,
          headers: row.headers,
          env: row.env,
          enabled: row.enabled,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        ...state.mcpServers,
      ],
    }));
  };
