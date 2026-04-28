import { deleteMcpServer as deleteMcpServerAction } from "@/lib/mcp/delete-mcp-server";
import { EntitySet } from "../types";

/**
 * Removes an MCP server from DB and store.
 * @param set - Store setter.
 */
export const removeMcpServer = (set: EntitySet) => async (id: string) => {
  await deleteMcpServerAction(id);
  set((state) => ({
    mcpServers: state.mcpServers.filter((s) => s.id !== id),
  }));
};
