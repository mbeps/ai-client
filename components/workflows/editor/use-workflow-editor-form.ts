"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { getWorkflow } from "@/actions/workflows/get-workflow";
import { hydrateWorkflowFormState } from "@/components/workflows/editor/workflow-editor-helpers";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { ERROR_CODE } from "@/lib/error/error-code";
import { useAppStore } from "@/lib/store/use-app-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { SkillMode } from "@/schemas/skill/skill-config";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
  type WorkflowApprovalConfig,
  type WorkflowCanvasConfig,
  type WorkflowEdge,
  type WorkflowNode,
} from "@/types/workflows/workflow";

function createInitialNodes(): WorkflowNode[] {
  const triggerId = "initial-trigger";
  const stepId = "initial-step";
  return [
    {
      id: triggerId,
      type: "manual_trigger",
      name: "Manual Trigger",
      position: { x: 80, y: 180 },
      data: {
        kind: "manual_trigger",
        variableName: "trigger",
        requiresFileUpload: false,
      },
    },
    {
      id: stepId,
      type: "ai_step",
      name: "AI Step 1",
      position: { x: 420, y: 180 },
      data: {
        kind: "ai_step",
        variableName: "step1",
        prompt: "Describe what this step should do...",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    },
  ];
}

function createInitialEdges(): WorkflowEdge[] {
  return [
    {
      id: "initial-edge",
      sourceNodeId: "initial-trigger",
      targetNodeId: "initial-step",
      sourceHandle: "main",
      targetHandle: "main",
    },
  ];
}

/** Params for {@link useWorkflowEditorForm}. */
export interface UseWorkflowEditorFormParams {
  id: string;
  isNew: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

/**
 * Manages workflow configuration state, DAG nodes/edges, and initial hydration.
 */
export function useWorkflowEditorForm({
  id,
  isNew,
  handleApiError,
}: UseWorkflowEditorFormParams) {
  const { mcpServers, loadMcpServers, skills, loadSkills, agents, loadAgents } =
    useAppStore();
  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [globalContext, setGlobalContext] = useState("");
  const [modelId, setModelId] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort | null>(null);
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [skillMode, setSkillMode] = useState<SkillMode>("dynamic");
  const [skillIds, setSkillIds] = useState<Set<string>>(new Set());
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<Set<string>>(
    new Set(),
  );
  const [subagentIds, setSubagentIds] = useState<string[]>([]);
  const [requiresFileUpload, setRequiresFileUpload] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState<WorkflowCanvasConfig>(
    DEFAULT_WORKFLOW_CANVAS_CONFIG,
  );
  const [approvalConfig, setApprovalConfig] = useState<WorkflowApprovalConfig>(
    DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  );
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>(() =>
    isNew ? createInitialNodes() : [],
  );
  const [edges, setEdges] = useState<WorkflowEdge[]>(() =>
    isNew ? createInitialEdges() : [],
  );
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    if (mcpServers.length === 0) loadMcpServers();
    if (skills.length === 0) loadSkills();
    if (agents.length === 0) loadAgents();
  }, [
    mcpServers.length,
    loadMcpServers,
    skills.length,
    loadSkills,
    agents.length,
    loadAgents,
  ]);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    async function load() {
      try {
        const res = await getWorkflow(id);
        if (!res.ok || !res.value) {
          if (mounted) {
            if (!res.ok && res.error.code !== ERROR_CODE.NOT_FOUND) {
              handleApiError(res.error, "Failed to load workflow");
            } else {
              setIsNotFound(true);
            }
          }
          return;
        }
        if (mounted) {
          hydrateWorkflowFormState(res.value, {
            setName,
            setDescription,
            setGlobalContext,
            setModelId,
            setReasoningEffort,
            setTools,
            setSkillMode,
            setSkillIds,
            setKnowledgeBaseIds,
            setSubagentIds,
            setRequiresFileUpload,
            setCanvasConfig,
            setApprovalConfig,
            setWebhookSecret,
            setNodes,
            setEdges,
          });
        }
      } catch (err) {
        if (mounted) handleApiError(err, "Failed to load workflow");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, isNew, handleApiError]);

  const handleToggleTool = (serverId: string, toolName: string) => {
    setTools((prev) => toggleSetItem(prev, `${serverId}:${toolName}`));
  };

  const handleBulkSelectTools = (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => {
    setTools((prev) =>
      updateBulkToolSelection(prev, serverId, toolNames, enabled),
    );
  };

  const handleToggleSubagent = (agentId: string) => {
    setSubagentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((item) => item !== agentId)
        : [...prev, agentId],
    );
  };

  if (isNotFound) {
    notFound();
  }

  return {
    mcpServers,
    skills,
    agents,
    knowledgebases,
    name,
    setName,
    description,
    setDescription,
    globalContext,
    setGlobalContext,
    modelId,
    setModelId,
    reasoningEffort,
    setReasoningEffort,
    tools,
    setTools,
    skillMode,
    setSkillMode,
    skillIds,
    setSkillIds,
    knowledgeBaseIds,
    setKnowledgeBaseIds,
    subagentIds,
    setSubagentIds,
    handleToggleSubagent,
    requiresFileUpload,
    setRequiresFileUpload,
    canvasConfig,
    setCanvasConfig,
    approvalConfig,
    setApprovalConfig,
    webhookSecret,
    setWebhookSecret,
    nodes,
    setNodes,
    edges,
    setEdges,
    isLoading,
    isNotFound,
    handleToggleTool,
    handleBulkSelectTools,
  };
}
