// Module-level: tracks resources that have been successfully hydrated this session.
// Exported for test teardown only — do not mutate outside this module.
/**
 * Performs hydrated resources.
 *
 * @author Maruf Bepary
 */
export const hydratedResources = new Set<string>();
