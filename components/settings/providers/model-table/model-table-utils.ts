import type { AiModelRow } from "@/types/provider/ai-model-row";

/**
 * Represents model filters.
 *
 * @author Maruf Bepary
 */
export type ModelFilters = {
  search: string;
  providerFilter: string;
  statusFilter: string;
  typeFilter: "all" | "chat" | "embedding" | "both";
};

/**
 * Performs matches model type.
 *
 * @param modelType - Target model type
 * @param typeFilter - Target type filter
 * @returns The resolved result
 * @author Maruf Bepary
 */
function matchesModelType(
  modelType: string,
  typeFilter: "all" | "chat" | "embedding" | "both",
): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "both") return modelType === "both";
  return modelType === typeFilter || modelType === "both";
}

/**
 * Performs matches status filter.
 *
 * @param isEnabled - Target is enabled
 * @param statusFilter - Target status filter
 * @returns The resolved result
 * @author Maruf Bepary
 */
function matchesStatusFilter(
  isEnabled: boolean,
  statusFilter: string,
): boolean {
  if (statusFilter === "all") return true;
  return statusFilter === "enabled" ? isEnabled : !isEnabled;
}

/**
 * Performs matches search query.
 *
 * @param model - Target model
 * @param query - Target query
 * @param providerName - Target provider name
 * @returns The resolved result
 * @author Maruf Bepary
 */
function matchesSearchQuery(
  model: AiModelRow,
  query: string,
  providerName: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    model.label.toLowerCase().includes(q) ||
    model.modelId.toLowerCase().includes(q) ||
    providerName.toLowerCase().includes(q)
  );
}

/**
 * Performs matches model filters.
 *
 * @param model - Target model
 * @param filters - Target filters
 * @param providerName - Target provider name
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function matchesModelFilters(
  model: AiModelRow,
  filters: ModelFilters,
  providerName: string,
): boolean {
  if (
    filters.providerFilter !== "all" &&
    model.providerId !== filters.providerFilter
  ) {
    return false;
  }
  if (!matchesModelType(model.modelType, filters.typeFilter)) {
    return false;
  }
  if (!matchesStatusFilter(model.isEnabled, filters.statusFilter)) {
    return false;
  }
  return matchesSearchQuery(model, filters.search.trim(), providerName);
}
