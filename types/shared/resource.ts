/**
 * Base resource interface requiring a unique string identifier.
 *
 * @author Maruf Bepary
 */
export interface BaseResource {
  id: string;
}

/**
 * Base resource interface with entity creation and modification timestamps.
 *
 * @author Maruf Bepary
 */
export interface TimedResource extends BaseResource {
  createdAt: Date;
  updatedAt: Date;
}
