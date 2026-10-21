"use client";

import {
  Bot,
  BrainCircuit,
  FileText,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteAssistant } from "@/actions/assistants/delete-assistant";
import { updateAssistant } from "@/actions/assistants/update-assistant";
import { listChats } from "@/actions/chats/list-chats";
import { AssistantChatsTab } from "@/components/assistant/assistant-chats-tab";
import { AssistantPromptTab } from "@/components/assistant/assistant-prompt-tab";
import { AssistantSettingsTab } from "@/components/assistant/assistant-settings-tab";
import { AssistantToolsTab } from "@/components/assistant/assistant-tools-tab";
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
import { ROUTES } from "@/config/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store";
import {
  sortByUpdatedAt,
  toggleSetItem,
  updateBulkToolSelection,
} from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";

function resolveStringField(val?: string | null): string {
  return val ? val : "";
}

function resolveSetField(arr?: string[] | null): Set<string> {
  return new Set(arr ? arr : []);
}

type AssistantFormState = {
  name: string;
  description: string;
  prompt: string;
  selectedTools: Set<string>;
  skillMode: SkillMode;
  selectedSkillIds: Set<string>;
};

function buildInitialAssistantForm(assistant?: any): AssistantFormState {
  if (!assistant) {
    return {
      name: "",
      description: "",
      prompt: "",
      selectedTools: new Set<string>(),
      skillMode: "dynamic",
      selectedSkillIds: new Set<string>(),
    };
  }

  return {
    name: assistant.name,
    description: resolveStringField(assistant.description),
    prompt: resolveStringField(assistant.prompt),
    selectedTools: resolveSetField(assistant.tools),
    skillMode: assistant.skillMode || "dynamic",
    selectedSkillIds: resolveSetField(assistant.skillIds),
  };
}

function useAssistantEditor(assistantId: string, assistant?: any) {
  const router = useRouter();
  const loadAssistants = useAppStore((state) => state.loadAssistants);

  const [form, setForm] = useState<AssistantFormState>(() =>
    buildInitialAssistantForm(assistant),
  );
  const [saving, setSaving] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);

  useEffect(() => {
    if (assistant) {
      setForm(buildInitialAssistantForm(assistant));
    }
  }, [assistant]);

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    try {
      await updateAssistant(assistantId, {
        skillMode: form.skillMode,
        skillIds: Array.from(form.selectedSkillIds),
      });
      toast.success("Assistant skills saved");
      await loadAssistants();
      router.refresh();
    } catch {
      toast.error("Failed to save assistant skills");
    } finally {
      setSavingSkills(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssistant(assistantId, {
        name: form.name,
        description: form.description,
        prompt: form.prompt,
        tools: Array.from(form.selectedTools),
      });
      toast.success("Assistant updated");
      await loadAssistants();
      router.refresh();
    } catch {
      toast.error("Failed to update assistant");
    } finally {
      setSaving(false);
    }
  };

  const onToggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setForm((prev) => ({
      ...prev,
      selectedTools: toggleSetItem(prev.selectedTools, toolId),
    }));
  };

  const onBulkSelect = (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      selectedTools: updateBulkToolSelection(
        prev.selectedTools,
        serverId,
        toolNames,
        enabled,
      ),
    }));
  };

  return {
    form,
    setForm,
    saving,
    savingSkills,
    handleSave,
    handleSaveSkills,
    onToggleTool,
    onBulkSelect,
  };
}

function useAssistantDeletion(assistantId: string) {
  const router = useRouter();
  const loadAssistants = useAppStore((state) => state.loadAssistants);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAssistant(assistantId);
      toast.success("Assistant deleted");
      await loadAssistants();
      router.refresh();
      router.push(ROUTES.ASSISTANTS.path);
    } catch {
      toast.error("Failed to delete assistant");
      setDeleting(false);
    }
  };

  return {
    deleting,
    showDeleteDialog,
    setShowDeleteDialog,
    handleDelete,
  };
}

function useAssistantChats(assistantId: string) {
  const allChats = useAppStore((state) => state.chats);
  const loadChats = useAppStore((state) => state.loadChats);
  const createNewChat = useCreateChat();
  const [searchQuery, setSearchQuery] = useState("");

  const chats = useMemo(() => {
    return Object.values(allChats).filter((c) => c.assistantId === assistantId);
  }, [allChats, assistantId]);

  // Load assistant-specific chats on mount
  useEffect(() => {
    if (chats.length === 0) {
      listChats().then((rows) => loadChats(rows, []));
    }
  }, [chats.length, loadChats]);

  const filteredChats = useMemo(() => {
    return sortByUpdatedAt(
      chats.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [chats, searchQuery]);

  const handleNewChat = () => createNewChat("New Chat", undefined, assistantId);

  return {
    searchQuery,
    setSearchQuery,
    filteredChats,
    handleNewChat,
  };
}

function useAssistantPageResources(assistantId: string) {
  const assistants = useAppStore((state) => state.assistants);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);

  const { isLoading: hydrationLoading } = useResourceHydration([
    "assistants",
    "mcpServers",
    "skills",
  ]);

  const assistant = assistants.find((a) => a.id === assistantId);
  const isLoading = hydrationLoading || (assistants.length === 0 && !assistant);

  return {
    assistant,
    mcpServers,
    skills,
    isLoading,
  };
}

type AssistantPageTabsProps = {
  tab: string;
  onTabChange: (tab: string) => void;
  assistantChats: ReturnType<typeof useAssistantChats>;
  editor: ReturnType<typeof useAssistantEditor>;
  mcpServers: any[];
  skills: any[];
  deletion: ReturnType<typeof useAssistantDeletion>;
};

function AssistantPageTabs(props: AssistantPageTabsProps) {
  const {
    tab,
    onTabChange,
    assistantChats,
    editor,
    mcpServers,
    skills,
    deletion,
  } = props;

  return (
    <SidebarTabs value={tab} onValueChange={onTabChange} className="w-full">
      <SidebarTabsList>
        <SidebarTabsTrigger value="chats">
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>Chats</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="prompt">
          <FileText className="mr-2 h-4 w-4" />
          <span>Prompt</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="settings">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="tools">
          <Wrench className="mr-2 h-4 w-4" />
          <span>Tools</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="skills">
          <BrainCircuit className="mr-2 h-4 w-4" />
          <span>Skills</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="danger">
          <Shield className="mr-2 h-4 w-4" />
          <span>Danger Zone</span>
        </SidebarTabsTrigger>
      </SidebarTabsList>

      <SidebarTabsContent value="chats">
        <AssistantChatsTab
          searchQuery={assistantChats.searchQuery}
          onSearchQueryChange={assistantChats.setSearchQuery}
          filteredChats={assistantChats.filteredChats}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="prompt">
        <AssistantPromptTab
          prompt={editor.form.prompt}
          onPromptChange={(val) =>
            editor.setForm((prev) => ({ ...prev, prompt: val }))
          }
          onSave={editor.handleSave}
          isSaving={editor.saving}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="settings">
        <AssistantSettingsTab
          name={editor.form.name}
          onNameChange={(val) =>
            editor.setForm((prev) => ({ ...prev, name: val }))
          }
          description={editor.form.description}
          onDescriptionChange={(val) =>
            editor.setForm((prev) => ({ ...prev, description: val }))
          }
          onSave={editor.handleSave}
          isSaving={editor.saving}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="tools">
        <AssistantToolsTab
          mcpServers={mcpServers}
          selectedTools={editor.form.selectedTools}
          onToggleTool={editor.onToggleTool}
          onBulkSelect={editor.onBulkSelect}
          onSave={editor.handleSave}
          isSaving={editor.saving}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="skills">
        <SkillsConfigTab
          skillMode={editor.form.skillMode}
          onSkillModeChange={(val) =>
            editor.setForm((prev) => ({ ...prev, skillMode: val }))
          }
          selectedSkillIds={editor.form.selectedSkillIds}
          onToggleSkill={(id) =>
            editor.setForm((prev) => ({
              ...prev,
              selectedSkillIds: toggleSetItem(prev.selectedSkillIds, id),
            }))
          }
          onSelectSkills={(ids) =>
            editor.setForm((prev) => ({ ...prev, selectedSkillIds: ids }))
          }
          skills={skills}
          onSave={editor.handleSaveSkills}
          isSaving={editor.savingSkills}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="danger">
        <DangerZoneCard
          title="Danger Zone"
          description="Irreversible actions for this assistant."
          consequences="Deleting this assistant will permanently remove it. This action cannot be undone."
          buttonLabel="Delete Assistant"
          onDelete={() => deletion.setShowDeleteDialog(true)}
          isDeleting={deletion.deleting}
        />
      </SidebarTabsContent>
    </SidebarTabs>
  );
}

/**
 * Assistant detail page — client component for viewing and editing assistant configuration.
 * Route parameter: `[id]` — Unique assistant identifier.
 * Features: edit name/description/system prompt, view related chats, delete assistant, create new chats.
 * Shows 404 if assistant not found.
 *
 * @see AssistantChatPage for individual chat within an assistant
 */
export default function AssistantPage() {
  const params = useParams();
  const assistantId = params.id as string;
  const { assistant, mcpServers, skills, isLoading } =
    useAssistantPageResources(assistantId);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("settings").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const editor = useAssistantEditor(assistantId, assistant);
  const deletion = useAssistantDeletion(assistantId);
  const assistantChats = useAssistantChats(assistantId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistant) {
    notFound();
  }

  return (
    <PageContainer className="space-y-6">
      <EntityDetailHeader
        icon={<Bot className="h-8 w-8 text-primary" />}
        title={assistant.name}
        description={assistant.description}
        actionLabel="Chat with Assistant"
        actionIcon={<MessageSquarePlus className="h-4 w-4" />}
        onAction={assistantChats.handleNewChat}
      />

      <AssistantPageTabs
        tab={tab}
        onTabChange={setTab}
        assistantChats={assistantChats}
        editor={editor}
        mcpServers={mcpServers}
        skills={skills}
        deletion={deletion}
      />

      <DeleteConfirmDialog
        isOpen={deletion.showDeleteDialog}
        onClose={() => deletion.setShowDeleteDialog(false)}
        onConfirm={deletion.handleDelete}
        title={`Delete "${assistant.name}"?`}
        description="This will permanently delete this assistant. Existing chats created with this assistant will not be deleted. This action cannot be undone."
        loading={deletion.deleting}
      />
    </PageContainer>
  );
}
