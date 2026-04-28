import { listMcpServers as listMcpServersAction } from "@/lib/mcp/list-mcp-servers";
import { EntitySet } from "../types";

/**
 * Fetches all MCP servers and loads them into store.
 * @param set - Store setter.
 */
export const loadMcpServers = (set: EntitySet) => async () => {
  const rows = await listMcpServersAction();
  set({
    mcpServers: rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      command: r.command,
      args: r.args,
      url: r.url,
      headers: r.headers,
      env: r.env,
      enabled: r.enabled,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
  });
};
