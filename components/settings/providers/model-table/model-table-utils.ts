import type { AiModelRow } from "@/types/provider/ai-model-row";

export type ModelFilters = {
  search: string;
  providerFilter: string;
  statusFilter: string;
  typeFilter: "all" | "chat" | "embedding" | "both";
};

function matchesModelType(
  modelType: string,
  typeFilter: "all" | "chat" | "embedding" | "both",
): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "both") return modelType === "both";
  return modelType === typeFilter || modelType === "both";
}

function matchesStatusFilter(
  isEnabled: boolean,
  statusFilter: string,
): boolean {
  if (statusFilter === "all") return true;
  return statusFilter === "enabled" ? isEnabled : !isEnabled;
}

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
