/**
 * A resource with an identifier and an update timestamp, sortable by recency.
 */
export interface SortableResource {
  id: string;
  updatedAt: Date;
}
