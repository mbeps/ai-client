"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateAgent } from "@/actions/agents/update-agent";
import {
  type AgentGuardrails,
  DEFAULT_AGENT_GUARDRAILS,
} from "@/drizzle/schemas/agent-schema";
import { useAppStore } from "@/lib/store/use-app-store";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Agent } from "@/types/agent/agent";

export type AgentFormState = {
  name: string;
  description: string;
  modelId: string | null;
  prompt: string;
  subagentPrompt: string;
  selectedKbIds: string[];
  selectedTools: Set<string>;
  skillMode: SkillMode;
  selectedSkillIds: Set<string>;
  promptMode: "all" | "none" | "specific";
  selectedPromptIds: Set<string>;
  selectedSubagentIds: string[];
  guardrails: AgentGuardrails;
};

/**
 * Builds initial form state from an Agent entity (or empty defaults).
 */
export function buildInitialAgentForm(agent?: Agent): AgentFormState {
  if (!agent) {
    return {
      name: "",
      description: "",
      modelId: null,
      prompt: "",
      subagentPrompt: "",
      selectedKbIds: [],
      selectedTools: new Set<string>(),
      skillMode: "dynamic",
      selectedSkillIds: new Set<string>(),
      promptMode: "all",
      selectedPromptIds: new Set<string>(),
      selectedSubagentIds: [],
      guardrails: DEFAULT_AGENT_GUARDRAILS,
    };
  }

  return {
    name: agent.name,
    description: agent.description ?? "",
    modelId: agent.modelId ?? null,
    prompt: agent.prompt ?? "",
    subagentPrompt: agent.subagentPrompt ?? "",
    selectedKbIds: agent.knowledgebaseIds ?? [],
    selectedTools: new Set(agent.tools ?? []),
    skillMode: agent.skillMode || "dynamic",
    selectedSkillIds: new Set(agent.skillIds ?? []),
    promptMode: agent.promptMode || "all",
    selectedPromptIds: new Set(agent.promptIds ?? []),
    selectedSubagentIds: agent.subagentIds ?? [],
    guardrails: agent.guardrails ?? DEFAULT_AGENT_GUARDRAILS,
  };
}

/**
 * Manages form state and section-level save handlers for an existing Agent.
 */
export function useAgentEditor(agentId: string, agent?: Agent) {
  const loadAgents = useAppStore((state) => state.loadAgents);
  const [form, setForm] = useState<AgentFormState>(() =>
    buildInitialAgentForm(agent),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setForm(buildInitialAgentForm(agent));
    }
  }, [agent]);

  const savePatch = async (
    patch: Parameters<typeof updateAgent>[1],
    successMessage: string,
  ) => {
    setSaving(true);
    try {
      const res = await updateAgent(agentId, patch);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to update agent");
        return;
      }
      await loadAgents();
      toast.success(successMessage);
    } catch {
      toast.error("Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setForm,
    saving,
    handleSaveDetails: () => {
      if (!form.name.trim()) return;
      return savePatch(
        {
          name: form.name.trim(),
          description: form.description.trim(),
          modelId: form.modelId,
        },
        "Agent details saved",
      );
    },
    handleSavePrompts: () =>
      savePatch(
        {
          prompt: form.prompt,
          subagentPrompt: form.subagentPrompt,
          promptMode: form.promptMode,
          promptIds: Array.from(form.selectedPromptIds),
        },
        "Prompts saved",
      ),
    handleSaveTools: () =>
      savePatch({ tools: Array.from(form.selectedTools) }, "Tools saved"),
    handleSaveKbs: () =>
      savePatch(
        { knowledgebaseIds: form.selectedKbIds },
        "Knowledge bases saved",
      ),
    handleSaveSkills: () =>
      savePatch(
        {
          skillMode: form.skillMode,
          skillIds: Array.from(form.selectedSkillIds),
        },
        "Skills saved",
      ),
    handleSaveSubagents: () =>
      savePatch({ subagentIds: form.selectedSubagentIds }, "Subagents saved"),
    handleSaveGuardrails: () =>
      savePatch({ guardrails: form.guardrails }, "Guardrails saved"),
  };
}
