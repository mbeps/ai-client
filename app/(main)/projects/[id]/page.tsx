"use client";

import { useAppStore } from "@/lib/store";
import { sortByUpdatedAt, toggleSetItem } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";

import { Button } from "@/components/ui/button";
import {
  Library,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  FileText,
  Shield,
  Wrench,
  FolderKanban,
} from "lucide-react";
import { ProjectChatsTab } from "@/components/project/project-chats-tab";
import { ProjectKnowledgebaseTab } from "@/components/project/project-knowledgebase-tab";
import { ProjectPromptTab } from "@/components/project/project-prompt-tab";
import { ProjectSettingsTab } from "@/components/project/project-settings-tab";
import { ProjectToolsTab } from "@/components/project/project-tools-tab";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { ROUTES } from "@/constants/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { deleteProject } from "@/lib/actions/projects/delete-project";
import { updateProject } from "@/lib/actions/projects/update-project";
import { useState, useEffect, useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { toast } from "sonner";

/**
 * Project detail page — client component for viewing and editing project configuration.
 * Route parameter: `[id]` — Unique project identifier.
 * Features: edit name/description/global system prompt, view related chats, delete project, create new chats.
 * Shows 404 if project not found.
 *
 * @author Maruf Bepary
 * @see ProjectChatPage for individual chat within a project
 */
export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const projects = useAppStore((state) => state.projects);
  const project = projects.find((p) => p.id === projectId);
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.projectId === projectId,
  );
  const createNewChat = useCreateChat();
  const loadProjects = useAppStore((state) => state.loadProjects);
  const loadChats = useAppStore((state) => state.loadChats);
  const mcpServers = useAppStore((state) => state.mcpServers);

  const { normalizedKnowledgebases } = useKnowledgebases();

  // Centralised hydration for all required entities
  const { isLoading: hydrationLoading } = useResourceHydration([
    "projects",
    "mcpServers",
  ]);

  const [loadingChats, setLoadingChats] = useState(false);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [globalPrompt, setGlobalPrompt] = useState(project?.globalPrompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(project?.tools || []),
  );
  const [selectedKbId, setSelectedKbId] = useState<string | null>(
    project?.knowledgebaseId ?? null,
  );
  const [savingKb, setSavingKb] = useState(false);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("chats").withOptions({
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

  // Load project-specific chats on mount if not already loaded into store
  useEffect(() => {
    if (chats.length === 0) {
      setLoadingChats(true);
      listChats()
        .then((rows) => loadChats(rows, []))
        .finally(() => setLoadingChats(false));
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setGlobalPrompt(project.globalPrompt ?? "");
      setSelectedTools(new Set(project.tools || []));
      setSelectedKbId(project.knowledgebaseId ?? null);
    }
  }, [project]);

  const loading = hydrationLoading || (projects.length === 0 && !project);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return <NotFoundMessage entity="Project" />;

  const handleNewChat = () => createNewChat("New Chat", projectId);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProject(projectId, {
        name,
        description,
        globalPrompt,
        tools: Array.from(selectedTools),
      });
      toast.success("Project settings saved");
      await loadProjects();
      router.refresh();
    } catch {
      toast.error("Failed to save project settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveKb = async () => {
    setSavingKb(true);
    try {
      await updateProject(projectId, {
        name,
        description,
        globalPrompt,
        knowledgebaseId: selectedKbId,
        tools: Array.from(selectedTools),
      });
      toast.success("Knowledge base associated");
      await loadProjects();
      router.refresh();
    } catch {
      toast.error("Failed to associate knowledge base");
    } finally {
      setSavingKb(false);
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
      await deleteProject(projectId);
      toast.success("Project deleted");
      await loadProjects();
      router.refresh();
      router.push(ROUTES.PROJECTS.path);
    } catch {
      toast.error("Failed to delete project");
      setDeleting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>
        <Button onClick={handleNewChat} size="lg" className="w-full md:w-auto">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="chats">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chats</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledge">
            <Library className="mr-2 h-4 w-4" />
            <span>Knowledge</span>
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
          <ProjectChatsTab
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filteredChats={filteredChats}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="knowledge">
          <ProjectKnowledgebaseTab
            knowledgebases={normalizedKnowledgebases}
            selectedKbId={selectedKbId}
            onSelectKbId={setSelectedKbId}
            onSave={handleSaveKb}
            isSaving={savingKb}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <ProjectPromptTab
            globalPrompt={globalPrompt}
            onGlobalPromptChange={setGlobalPrompt}
            onSave={handleSaveSettings}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="settings">
          <ProjectSettingsTab
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            onSave={handleSaveSettings}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="tools">
          <ProjectToolsTab
            mcpServers={mcpServers}
            selectedTools={selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
            onSave={handleSaveSettings}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="danger">
          <DangerZoneCard
            title="Danger Zone"
            description="Irreversible actions for this project."
            consequences="Deleting this project will permanently remove it. Chats will be dissociated but not deleted. This action cannot be undone."
            buttonLabel="Delete Project"
            onDelete={() => setShowDeleteDialog(true)}
            isDeleting={deleting}
          />
        </SidebarTabsContent>
      </SidebarTabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${project.name}"?`}
        description="This will permanently delete the project. Chats will be dissociated but not deleted. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
