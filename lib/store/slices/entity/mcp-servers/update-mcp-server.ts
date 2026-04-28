import { updateMcpServer as updateMcpServerAction } from "@/lib/mcp/update-mcp-server";
import { UpdateMcpServer } from "@/schemas/mcp-server";
import { EntitySet } from "../types";

/**
 * Updates MCP server configuration in DB and store.
 * @param set - Store setter.
 */
export const updateMcpServer =
  (set: EntitySet) => async (id: string, data: UpdateMcpServer) => {
    const updated = await updateMcpServerAction(id, data);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                id: updated.id,
                name: updated.name,
                type: updated.type,
                command: updated.command,
                args: updated.args,
                url: updated.url,
                headers: updated.headers,
                env: updated.env,
                enabled: updated.enabled,
                createdAt: new Date(updated.createdAt),
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  };
