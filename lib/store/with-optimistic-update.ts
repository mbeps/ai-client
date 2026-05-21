/**
 * Generic helper for optimistic updates in the store.
 * Applies optimistic change, runs server action, and reverts on failure.
 */
export async function withOptimisticUpdate(
  update: () => void,
  action: () => Promise<any>,
  rollback: () => void,
  options: { swallowError?: boolean } = {},
) {
  update();
  try {
    await action();
  } catch (err) {
    rollback();
    if (!options.swallowError) {
      throw err;
    }
  }
}
