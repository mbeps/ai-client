/**
 * Updates a set of selected tools by adding or removing all tools belonging to a server.
 * Tool IDs follow the format `${serverId}:tool:${toolName}`.
 * Does not mutate the original set.
 */
export function updateBulkToolSelection(
  prevTools: ReadonlySet<string>,
  serverId: string,
  toolNames: readonly string[],
  select: boolean,
): Set<string> {
  const next = new Set(prevTools);
  for (const name of toolNames) {
    const id = `${serverId}:tool:${name}`;
    if (select) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}
