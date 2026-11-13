"use client";

import {
  Bot,
  BrainCircuit,
  Database,
  FileText,
  Info,
  MessageSquare,
  MessageSquarePlus,
  Network,
  Settings,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteAgent } from "@/actions/agents/delete-agent";
import { listChats } from "@/actions/chats/list-chats";
import { AgentChatsTab } from "@/components/agent/agent-chats-tab";
import { AgentGuardrailsTab } from "@/components/agent/agent-guardrails-tab";
import { AgentKnowledgebasesTab } from "@/components/agent/agent-knowledgebases-tab";
import { AgentPromptTab } from "@/components/agent/agent-prompt-tab";
import { AgentSettingsTab } from "@/components/agent/agent-settings-tab";
import { AgentSubagentsTab } from "@/components/agent/agent-subagents-tab";
import { AgentToolsTab } from "@/components/agent/agent-tools-tab";
import { useAgentEditor } from "@/components/agent/use-agent-editor";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { EntityDetailHeader } from "@/components/shared/entity-detail-header";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getBuiltInAgentById } from "@/config/built-in-agents";
import { ROUTES } from "@/config/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { sortByUpdatedAt } from "@/lib/sort-by-updated-at";
import { useAppStore } from "@/lib/store/use-app-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";

/**
 * Agent detail & workspace page (/agents/[id]).
 * Supports both custom user Agents and read-only Built-in System Agents.
 */
export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = typeof params.id === "string" ? params.id : "";
  const agentId = decodeURIComponent(rawId);
  if (agentId === "new") notFound();

  const agents = useAppStore((state) => state.agents);
  const chats = useAppStore((state) => state.chats);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);
  const loadChats = useAppStore((state) => state.loadChats);
  const loadAgents = useAppStore((state) => state.loadAgents);
  const deleteAgentFromStore = useAppStore((state) => state.deleteAgent);
  const createNewChat = useCreateChat();

  const { isLoading: hydrationLoading } = useResourceHydration([
    "agents",
    "mcpServers",
    "skills",
    "prompts",
  ]);

  const agent =
    agents.find((a) => a.id === agentId) ?? getBuiltInAgentById(agentId);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("chats").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    form,
    setForm,
    saving,
    handleSaveDetails,
    handleSavePrompts,
    handleSaveTools,
    handleSaveKbs,
    handleSaveSkills,
    handleSaveSubagents,
    handleSaveGuardrails,
  } = useAgentEditor(agentId, agent);

  useEffect(() => {
    if (Object.keys(chats).length === 0) {
      listChats()
        .then((res) => {
          if (res.ok) loadChats(res.value, []);
        })
        .catch(() => {});
    }
  }, [chats, loadChats]);

  const filteredChats = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = Object.values(chats).filter(
      (c) =>
        (c.agentId ?? c.assistantId) === agentId &&
        c.title.toLowerCase().includes(q),
    );
    return sortByUpdatedAt(list);
  }, [chats, agentId, searchQuery]);

  if (!agent) {
    if (hydrationLoading || agents.length === 0) {
      return <EntityDetailSkeleton />;
    }
    notFound();
  }

  const isBuiltIn = Boolean(agent.isBuiltIn);
  const isKbReader = agent.id === "builtin:kb-reader";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteAgent(agentId);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to delete agent");
        return;
      }
      deleteAgentFromStore(agentId);
      await loadAgents();
      toast.success("Agent deleted");
      router.push(ROUTES.AGENTS.path);
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <EntityDetailHeader
        icon={
          isBuiltIn ? (
            <ShieldCheck className="text-primary h-7 w-7" />
          ) : (
            <Bot className="text-primary h-7 w-7" />
          )
        }
        title={agent.name}
        description={agent.description}
        action={
          !isKbReader ? (
            <Button
              onClick={() => createNewChat("New Chat", undefined, agent.id)}
            >
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          ) : undefined
        }
      />

      {isBuiltIn && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Built-in System Agent — Read-Only</AlertTitle>
          <AlertDescription>
            {isKbReader
              ? "This built-in agent is invoked automatically by search_knowledge_base and cannot be edited, deleted, or chatted with directly."
              : "Built-in system agents cannot be edited or deleted. You can chat with this agent directly or link it as a subagent."}
          </AlertDescription>
        </Alert>
      )}

      <SidebarTabs value={tab} onValueChange={setTab}>
        <SidebarTabsList>
          <SidebarTabsTrigger value="chats">
            <MessageSquare className="h-4 w-4" />
            Chats
          </SidebarTabsTrigger>
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
          {!isBuiltIn && (
            <SidebarTabsTrigger value="danger" className="text-destructive">
              <Shield className="h-4 w-4" />
              Danger Zone
            </SidebarTabsTrigger>
          )}
        </SidebarTabsList>

        <SidebarTabsContent value="chats">
          <AgentChatsTab
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filteredChats={filteredChats}
          />
        </SidebarTabsContent>

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
            onSave={handleSaveDetails}
            isSaving={saving}
            disabled={isBuiltIn}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <AgentPromptTab
            agentId={agent.id}
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
            onSave={handleSavePrompts}
            isSaving={saving}
            disabled={isBuiltIn}
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
            onSave={handleSaveTools}
            isSaving={saving}
            disabled={isBuiltIn}
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
            onSave={handleSaveKbs}
            isSaving={saving}
            disabled={isBuiltIn}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="skills">
          <SkillsConfigTab
            agentId={agent.id}
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
            onSave={handleSaveSkills}
            isSaving={saving}
            saveLabel="Save Skills"
            disabled={isBuiltIn}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="subagents">
          <AgentSubagentsTab
            agentId={agent.id}
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
            usedByCount={agent.usedByCount}
            onSave={handleSaveSubagents}
            isSaving={saving}
            disabled={isBuiltIn}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="guardrails">
          <AgentGuardrailsTab
            guardrails={form.guardrails}
            onGuardrailsChange={(guardrails) =>
              setForm((p) => ({ ...p, guardrails }))
            }
            onSave={handleSaveGuardrails}
            isSaving={saving}
            disabled={isBuiltIn}
          />
        </SidebarTabsContent>

        {!isBuiltIn && (
          <SidebarTabsContent value="danger">
            <DangerZoneCard
              title="Delete Agent"
              description="Permanently delete this agent."
              consequences="Existing chats will remain as standalone conversations and linked subagent references will be removed."
              buttonLabel="Delete Agent"
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </SidebarTabsContent>
        )}
      </SidebarTabs>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Agent"
        description={`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </PageContainer>
  );
}
