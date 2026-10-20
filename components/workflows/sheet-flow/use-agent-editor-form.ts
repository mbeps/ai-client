"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { getTransformAgent } from "@/actions/transform-agents/get-transform-agent";
import {
  createNewStep,
  hydrateAgentFormState,
} from "@/components/workflows/sheet-flow/agent-editor-helpers";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useAppStore } from "@/lib/store";
import { toggleSetItem, updateBulkToolSelection } from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { TransformStep } from "@/types/transform/transform-step";

export interface UseAgentEditorFormParams {
  id: string;
  isNew: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

/**
 * Manages transform agent configuration fields, steps, tools, and entity loading.
 */
export function useAgentEditorForm(params: UseAgentEditorFormParams) {
  const { id, isNew, handleApiError } = params;
  const { mcpServers, loadMcpServers, skills, loadSkills } = useAppStore();
  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [globalContext, setGlobalContext] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [skillMode, setSkillMode] = useState<SkillMode>("dynamic");
  const [skillIds, setSkillIds] = useState<Set<string>>(new Set());
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<Set<string>>(
    new Set(),
  );
  const [requiresFileUpload, setRequiresFileUpload] = useState(true);
  const [steps, setSteps] = useState<TransformStep[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);

  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers();
    }
    if (skills.length === 0) {
      loadSkills();
    }
  }, [mcpServers.length, loadMcpServers, skills.length, loadSkills]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    async function loadAgent() {
      try {
        const agent = await getTransformAgent(id);
        if (!agent) {
          if (mounted) notFound();
          return;
        }
        if (mounted) {
          hydrateAgentFormState(agent, {
            setName,
            setDescription,
            setGlobalContext,
            setModelId,
            setTools,
            setSkillMode,
            setSkillIds,
            setKnowledgeBaseIds,
            setRequiresFileUpload,
            setSteps,
          });
        }
      } catch (err) {
        handleApiError(err, "Failed to load agent");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAgent();
    return () => {
      mounted = false;
    };
  }, [id, isNew, handleApiError]);

  const addStep = () => {
    setSteps((prev) => [...prev, createNewStep(prev.length)]);
  };

  const updateStep = (index: number, updates: Partial<TransformStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setTools((prev) => toggleSetItem(prev, toolId));
  };

  const toggleAllTools = (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => {
    setTools((prev) =>
      updateBulkToolSelection(prev, serverId, toolNames, enabled),
    );
  };

  return {
    name,
    setName,
    description,
    setDescription,
    globalContext,
    setGlobalContext,
    modelId,
    setModelId,
    tools,
    setTools,
    skillMode,
    setSkillMode,
    skillIds,
    setSkillIds,
    knowledgeBaseIds,
    setKnowledgeBaseIds,
    requiresFileUpload,
    setRequiresFileUpload,
    steps,
    setSteps,
    isLoading,
    mcpServers,
    skills,
    knowledgebases,
    addStep,
    updateStep,
    removeStep,
    toggleTool,
    toggleAllTools,
  };
}

