/**
 * Client-facing representation of a user memory item.
 *
 * @author Maruf Bepary
 */
export interface Memory {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
