import type { TransformAgentRow } from "@/types/transform-agent-row";
import type { TransformAgent, TransformStep } from "@/types/transform-agent";

export function transformAgentRowToStore(
  row: TransformAgentRow,
): TransformAgent {
  let steps: TransformStep[] = [];
  try {
    steps = JSON.parse(row.steps);
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    modelId: row.modelId ?? undefined,
    steps,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
