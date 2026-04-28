import { renameMcpServer as renameMcpServerAction } from "@/lib/mcp/rename-mcp-server";
import { EntitySet } from "../types";

/**
 * Renames an MCP server in DB and updates store.
 * @param set - Store setter.
 */
export const renameMcpServer =
  (set: EntitySet) => async (id: string, name: string) => {
    const updated = await renameMcpServerAction(id, name);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                ...s,
                name: updated.name,
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  };
