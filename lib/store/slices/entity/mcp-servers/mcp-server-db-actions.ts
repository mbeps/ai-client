import { createMcpServer as createMcpServerAction } from "@/lib/mcp/create-mcp-server";
import { deleteMcpServer as deleteMcpServerAction } from "@/lib/mcp/delete-mcp-server";
import { renameMcpServer as renameMcpServerAction } from "@/lib/mcp/rename-mcp-server";
import { toggleMcpServer as toggleMcpServerAction } from "@/lib/mcp/toggle-mcp-server";
import { updateMcpServer as updateMcpServerAction } from "@/lib/mcp/update-mcp-server";
import { listMcpServers as listMcpServersAction } from "@/lib/mcp/list-mcp-servers";
import { CreateMcpServer, UpdateMcpServer } from "@/schemas/mcp-server";
import { EntitySet } from "../types";

/** Fetches all MCP servers and loads them into store. */
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

/** Adds a new MCP server to DB and store. */
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

/** Removes an MCP server from DB and store. */
export const removeMcpServer = (set: EntitySet) => async (id: string) => {
  await deleteMcpServerAction(id);
  set((state) => ({
    mcpServers: state.mcpServers.filter((s) => s.id !== id),
  }));
};

/** Renames an MCP server in DB and updates store. */
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

/** Toggles MCP server enabled status in DB and store. */
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

/** Updates MCP server configuration in DB and store. */
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
