/**
 * Mapper for MCP Server entities.
 * Converts database rows to client-side store types.
 *
 * @author Maruf Bepary
 */
export function mcpServerRowToStore(r: any) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    command: r.command,
    args: r.args,
    url: r.url,
    headers: r.headers,
    env: r.env,
    enabled: r.enabled,
    isPublic: r.isPublic,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}
