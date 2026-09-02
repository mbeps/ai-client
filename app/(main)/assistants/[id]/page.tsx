"use client";

import {
  Bot,
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
import { AssistantChatsTab } from "@/components/assistant/assistant-chats-tab";
import { AssistantPromptTab } from "@/components/assistant/assistant-prompt-tab";
import { AssistantSettingsTab } from "@/components/assistant/assistant-settings-tab";
import { AssistantToolsTab } from "@/components/assistant/assistant-tools-tab";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { deleteAssistant } from "@/lib/actions/assistants/delete-assistant";
import { updateAssistant } from "@/lib/actions/assistants/update-assistant";
import { listChats } from "@/lib/actions/chats/list-chats";
import { useAppStore } from "@/lib/store";
import { sortByUpdatedAt, toggleSetItem } from "@/lib/utils";

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
  const router = useRouter();
  const assistantId = params.id as string;

  const assistants = useAppStore((state) => state.assistants);
  const assistant = assistants.find((a) => a.id === assistantId);
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.assistantId === assistantId,
  );
  const createNewChat = useCreateChat();
  const loadAssistants = useAppStore((state) => state.loadAssistants);
  const loadChats = useAppStore((state) => state.loadChats);
  const mcpServers = useAppStore((state) => state.mcpServers);

  // Centralised hydration for required entities
  const { isLoading: hydrationLoading } = useResourceHydration([
    "assistants",
    "mcpServers",
  ]);

  const [_loadingChats, setLoadingChats] = useState(false);
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [prompt, setPrompt] = useState(assistant?.prompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(assistant?.tools || []),
  );
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("settings").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const filteredChats = useMemo(() => {
    return sortByUpdatedAt(
      chats.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [chats, searchQuery]);

  // Load assistant-specific chats on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Load chats on assistantId change
  useEffect(() => {
    if (chats.length === 0) {
      setLoadingChats(true);
      listChats()
        .then((rows) => loadChats(rows, []))
        .finally(() => setLoadingChats(false));
    }
  }, [assistantId]);

  useEffect(() => {
    if (assistant) {
      setName(assistant.name);
      setDescription(assistant.description ?? "");
      setPrompt(assistant.prompt ?? "");
      setSelectedTools(new Set(assistant.tools || []));
    }
  }, [assistant]);

  const loading = hydrationLoading || (assistants.length === 0 && !assistant);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistant) {
    notFound();
  }

  const handleNewChat = () => createNewChat("New Chat", undefined, assistantId);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssistant(assistantId, {
        name,
        description,
        prompt,
        tools: Array.from(selectedTools),
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
    setSelectedTools((prev) => toggleSetItem(prev, toolId));
  };

  const onBulkSelect = (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      toolNames.forEach((name) => {
        const toolId = `${serverId}:tool:${name}`;
        if (enabled) {
          next.add(toolId);
        } else {
          next.delete(toolId);
        }
      });
      return next;
    });
  };

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

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-3xl">{assistant.name}</h1>
            <p className="text-muted-foreground">{assistant.description}</p>
          </div>
        </div>
        <Button onClick={handleNewChat} size="lg" className="w-full md:w-auto">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Chat with Assistant
        </Button>
      </div>

      <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
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
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="chats">
          <AssistantChatsTab
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filteredChats={filteredChats}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <AssistantPromptTab
            prompt={prompt}
            onPromptChange={setPrompt}
            onSave={handleSave}
            isSaving={saving}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="settings">
          <AssistantSettingsTab
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            onSave={handleSave}
            isSaving={saving}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="tools">
          <AssistantToolsTab
            mcpServers={mcpServers}
            selectedTools={selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
            onSave={handleSave}
            isSaving={saving}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="danger">
          <DangerZoneCard
            title="Danger Zone"
            description="Irreversible actions for this assistant."
            consequences="Deleting this assistant will permanently remove it. This action cannot be undone."
            buttonLabel="Delete Assistant"
            onDelete={() => setShowDeleteDialog(true)}
            isDeleting={deleting}
          />
        </SidebarTabsContent>
      </SidebarTabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${assistant.name}"?`}
        description="This will permanently delete the assistant. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
