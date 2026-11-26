import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";

/**
 * Loads the current workflow graph for `(userId, workflowId)` and builds a
 * concise, token-efficient system prompt for the Workflow Builder Side Chat.
 */
export async function buildWorkflowBuilderSystemPrompt(
  userId: string,
  workflowId: string,
  options?: { compactionSummary?: string | null },
): Promise<string> {
  const [wf] = await db
    .select({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
    })
    .from(workflow)
    .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId)))
    .limit(1);

  if (!wf) {
    return (
      `You are the Workflow Builder Assistant for workflow "${workflowId}". ` +
      `The workflow could not be loaded. Ask the user to verify it exists.`
    );
  }

  const [nodes, edges] = await Promise.all([
    db
      .select({
        id: workflowNode.id,
        name: workflowNode.name,
        type: workflowNode.type,
        position: workflowNode.position,
        data: workflowNode.data,
      })
      .from(workflowNode)
      .where(eq(workflowNode.workflowId, workflowId)),
    db
      .select({
        id: workflowEdge.id,
        sourceNodeId: workflowEdge.sourceNodeId,
        targetNodeId: workflowEdge.targetNodeId,
        sourceHandle: workflowEdge.sourceHandle,
        targetHandle: workflowEdge.targetHandle,
      })
      .from(workflowEdge)
      .where(eq(workflowEdge.workflowId, workflowId)),
  ]);

  const snapshot = JSON.stringify({
    id: wf.id,
    name: wf.name,
    description: wf.description,
    nodes,
    edges,
  });

  const sections = [
    `You are the Workflow Builder Assistant embedded in the Workflow Studio for "${wf.name}" (id: ${wf.id}).`,
    `Your job is to help the user design, inspect, and update THIS workflow using \`manage_workflow\`.`,
    `Rules:`,
    `- Always call \`manage_workflow\` with \`action: "update"\` and \`id: "${wf.id}"\`. Never attempt \`action: "create"\` or edit any other workflow.`,
    `- Keep the graph a valid DAG (no cycles).`,
    `- Supported node types (7):`,
    `  1. \`manual_trigger\`: { kind: "manual_trigger", variableName, requiresFileUpload? }`,
    `  2. \`webhook_trigger\`: { kind: "webhook_trigger", variableName, secretHeaderName? }`,
    `  3. \`ai_step\`: { kind: "ai_step", variableName, prompt, agentId?, modelId?, mcpServerIds: [], toolIds: [], requiresReview: boolean, reviewTiming?, outputMode?, structuredOutputSchema? }`,
    `  4. \`if_condition\`: { kind: "if_condition", variableName, evaluationMode: "deterministic"|"llm"|"hybrid", logic: "and"|"or", rules, llmConditionPrompt? } (handles: "true", "false")`,
    `  5. \`loop\`: { kind: "loop", variableName, mode: "for_each"|"count", itemsTemplate?, count?, maxIterations } (handles: "body", "done"; body & done subgraphs must be disjoint, no nested loops)`,
    `  6. \`filter\`: { kind: "filter", variableName, itemsTemplate, evaluationMode: "deterministic"|"llm", logic: "and"|"or", rules, llmFilterPrompt?, continueWhenEmpty? }`,
    `  7. \`http_request\`: { kind: "http_request", variableName, method, url, headers: [], body?, requiresReview? }`,
    `- Use \`inspect_workspace\` to discover available agents, MCP servers, or skills if needed, and \`app_help\` for app documentation.`,
    `Current Workflow JSON:\n\`\`\`json\n${snapshot}\n\`\`\``,
  ];

  if (options?.compactionSummary) {
    sections.push(
      `Earlier conversation summary:\n${options.compactionSummary}`,
    );
  }

  return sections.join("\n\n");
}
