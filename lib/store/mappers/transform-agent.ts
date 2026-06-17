import type { TransformAgentRow } from "@/types/transform/transform-agent-row";
import type {
  TransformAgent,
  TransformStep,
} from "@/types/transform/transform-agent";

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
    globalContext: row.globalContext ?? undefined,
    modelId: row.modelId ?? undefined,
    tools: row.tools,
    knowledgeBaseIds: row.knowledgeBaseIds,
    requiresFileUpload: row.requiresFileUpload,
    steps,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
