import { toggleMcpServer as toggleMcpServerAction } from "@/lib/mcp/toggle-mcp-server";
import { EntitySet } from "../types";

/**
 * Toggles MCP server enabled status in DB and store.
 * @param set - Store setter.
 */
export const toggleMcpServer = (set: EntitySet) => async (id: string) => {
  const updated = await toggleMcpServerAction(id);
  set((state) => ({
    mcpServers: state.mcpServers.map((s) =>
      s.id === id
        ? {
            ...s,
            enabled: updated.enabled,
            updatedAt: new Date(updated.updatedAt),
          }
        : s,
    ),
  }));
};
