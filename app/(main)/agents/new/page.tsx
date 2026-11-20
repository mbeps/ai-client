"use client";

import {
  Bot,
  BrainCircuit,
  ChevronLeft,
  Database,
  FileText,
  Network,
  Plus,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { createAgent } from "@/actions/agents/create-agent";
import { AgentGuardrailsTab } from "@/components/agent/agent-guardrails-tab";
import { AgentKnowledgebasesTab } from "@/components/agent/agent-knowledgebases-tab";
import { AgentPromptTab } from "@/components/agent/agent-prompt-tab";
import { AgentSettingsTab } from "@/components/agent/agent-settings-tab";
import { AgentSubagentsTab } from "@/components/agent/agent-subagents-tab";
import { AgentToolsTab } from "@/components/agent/agent-tools-tab";
import {
  type AgentFormState,
  buildInitialAgentForm,
} from "@/components/agent/use-agent-editor";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { ROUTES } from "@/config/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store/use-app-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";

/**
 * Dedicated page for creating a new custom Agent (/agents/new).
 */
export default function NewAgentPage() {
  const router = useRouter();
  const agents = useAppStore((state) => state.agents);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);
  const loadAgents = useAppStore((state) => state.loadAgents);

  const { isLoading: hydrationLoading } = useResourceHydration([
    "agents",
    "mcpServers",
    "skills",
    "prompts",
  ]);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("settings").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [form, setForm] = useState<AgentFormState>(() =>
    buildInitialAgentForm(),
  );
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Agent name is required");
      setTab("settings");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createAgent({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        prompt: form.prompt.trim() || undefined,
        subagentPrompt: form.subagentPrompt.trim() || undefined,
        modelId: form.modelId,
        knowledgebaseIds: form.selectedKbIds,
        tools: Array.from(form.selectedTools),
        skillMode: form.skillMode,
        skillIds: Array.from(form.selectedSkillIds),
        promptMode: form.promptMode,
        promptIds: Array.from(form.selectedPromptIds),
        subagentIds: form.selectedSubagentIds,
        guardrails: form.guardrails,
      });

      if (!res.ok) {
        toast.error(res.error.message || "Failed to create agent");
        return;
      }

      await loadAgents();
      toast.success("Agent created");
      router.push(ROUTES.AGENTS.detail(res.value.id));
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setIsCreating(false);
    }
  };

  if (hydrationLoading && agents.length === 0) {
    return <EntityDetailSkeleton />;
  }

  return (
    <PageContainer className="space-y-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 h-8 px-2"
          asChild
        >
          <Link href={ROUTES.AGENTS.path}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Agents
          </Link>
        </Button>

        <PageHeader
          icon={<Bot className="text-primary h-7 w-7" />}
          title="New Agent"
          description="Configure a unified AI persona for direct chat or subagent delegation."
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild disabled={isCreating}>
                <Link href={ROUTES.AGENTS.path}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Link>
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !form.name.trim()}
              >
                <LoadingSwap isLoading={isCreating}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </LoadingSwap>
              </Button>
            </div>
          }
        />
      </div>

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6">
        <SidebarTabsList>
          <SidebarTabsTrigger value="settings">
            <Settings className="h-4 w-4" />
            Details & Model
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="prompt">
            <FileText className="h-4 w-4" />
            Prompts
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="tools">
            <Wrench className="h-4 w-4" />
            Tools & MCP
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledgebases">
            <Database className="h-4 w-4" />
            Knowledge Bases
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="skills">
            <BrainCircuit className="h-4 w-4" />
            Skills
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="subagents">
            <Network className="h-4 w-4" />
            Subagents
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="guardrails">
            <ShieldCheck className="h-4 w-4" />
            Guardrails
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="settings">
          <AgentSettingsTab
            name={form.name}
            onNameChange={(name) => setForm((p) => ({ ...p, name }))}
            description={form.description}
            onDescriptionChange={(description) =>
              setForm((p) => ({ ...p, description }))
            }
            modelId={form.modelId}
            onModelIdChange={(modelId) => setForm((p) => ({ ...p, modelId }))}
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <AgentPromptTab
            prompt={form.prompt}
            onPromptChange={(prompt) => setForm((p) => ({ ...p, prompt }))}
            subagentPrompt={form.subagentPrompt}
            onSubagentPromptChange={(subagentPrompt) =>
              setForm((p) => ({ ...p, subagentPrompt }))
            }
            promptMode={form.promptMode}
            onPromptModeChange={(promptMode) =>
              setForm((p) => ({ ...p, promptMode }))
            }
            selectedPromptIds={form.selectedPromptIds}
            onTogglePromptId={(id) =>
              setForm((p) => ({
                ...p,
                selectedPromptIds: toggleSetItem(p.selectedPromptIds, id),
              }))
            }
            onSelectPromptIds={(ids) =>
              setForm((p) => ({ ...p, selectedPromptIds: ids }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="tools">
          <AgentToolsTab
            mcpServers={mcpServers}
            selectedTools={form.selectedTools}
            onToggleTool={(serverId, toolName) =>
              setForm((p) => ({
                ...p,
                selectedTools: toggleSetItem(
                  p.selectedTools,
                  `${serverId}:tool:${toolName}`,
                ),
              }))
            }
            onBulkSelect={(serverId, toolNames, enabled) =>
              setForm((p) => ({
                ...p,
                selectedTools: updateBulkToolSelection(
                  p.selectedTools,
                  serverId,
                  toolNames,
                  enabled,
                ),
              }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="knowledgebases">
          <AgentKnowledgebasesTab
            selectedKbIds={form.selectedKbIds}
            onToggleKb={(kbId) =>
              setForm((p) => ({
                ...p,
                selectedKbIds: p.selectedKbIds.includes(kbId)
                  ? p.selectedKbIds.filter((id) => id !== kbId)
                  : [...p.selectedKbIds, kbId],
              }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="skills">
          <SkillsConfigTab
            skills={skills}
            skillMode={form.skillMode}
            onSkillModeChange={(skillMode) =>
              setForm((p) => ({ ...p, skillMode }))
            }
            selectedSkillIds={form.selectedSkillIds}
            onToggleSkill={(id) =>
              setForm((p) => ({
                ...p,
                selectedSkillIds: toggleSetItem(p.selectedSkillIds, id),
              }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="subagents">
          <AgentSubagentsTab
            agents={agents}
            selectedSubagentIds={form.selectedSubagentIds}
            onToggleSubagent={(id) =>
              setForm((p) => ({
                ...p,
                selectedSubagentIds: p.selectedSubagentIds.includes(id)
                  ? p.selectedSubagentIds.filter((s) => s !== id)
                  : [...p.selectedSubagentIds, id],
              }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="guardrails">
          <AgentGuardrailsTab
            guardrails={form.guardrails}
            onGuardrailsChange={(guardrails) =>
              setForm((p) => ({ ...p, guardrails }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Agent"
          />
        </SidebarTabsContent>
      </SidebarTabs>
    </PageContainer>
  );
}
