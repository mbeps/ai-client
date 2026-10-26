// Module-level: tracks resources that have been successfully hydrated this session.
// Exported for test teardown only — do not mutate outside this module.
export const hydratedResources = new Set<string>();
