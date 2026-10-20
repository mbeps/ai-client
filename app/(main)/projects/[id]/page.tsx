"use client";

import {
  BrainCircuit,
  FileText,
  FolderKanban,
  Library,
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
import { listChats } from "@/actions/chats/list-chats";
import { deleteProject } from "@/actions/projects/delete-project";
import { updateProject } from "@/actions/projects/update-project";
import { ProjectChatsTab } from "@/components/project/project-chats-tab";
import { ProjectKnowledgebaseTab } from "@/components/project/project-knowledgebase-tab";
import { ProjectPromptTab } from "@/components/project/project-prompt-tab";
import { ProjectSettingsTab } from "@/components/project/project-settings-tab";
import { ProjectToolsTab } from "@/components/project/project-tools-tab";
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
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store";
import {
  sortByUpdatedAt,
  toggleSetItem,
  updateBulkToolSelection,
} from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";

type ProjectFormState = {
  name: string;
  description: string;
  globalPrompt: string;
  selectedTools: Set<string>;
  skillMode: SkillMode;
  selectedSkillIds: Set<string>;
  selectedKbId: string | null;
};

function resolveStringField(val?: string | null): string {
  return val ? val : "";
}

function resolveSetField(arr?: string[] | null): Set<string> {
  return new Set(arr ? arr : []);
}

function buildInitialProjectForm(project?: any): ProjectFormState {
  if (!project) {
    return {
      name: "",
      description: "",
      globalPrompt: "",
      selectedTools: new Set<string>(),
      skillMode: "dynamic",
      selectedSkillIds: new Set<string>(),
      selectedKbId: null,
    };
  }

  return {
    name: project.name,
    description: resolveStringField(project.description),
    globalPrompt: resolveStringField(project.globalPrompt),
    selectedTools: resolveSetField(project.tools),
    skillMode: project.skillMode || "dynamic",
    selectedSkillIds: resolveSetField(project.skillIds),
    selectedKbId: project.knowledgebaseId || null,
  };
}

function useProjectEditor(projectId: string, project?: any) {
  const router = useRouter();
  const loadProjects = useAppStore((state) => state.loadProjects);

  const [form, setForm] = useState<ProjectFormState>(() =>
    buildInitialProjectForm(project),
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [savingKb, setSavingKb] = useState(false);

  useEffect(() => {
    if (project) {
      setForm(buildInitialProjectForm(project));
    }
  }, [project]);

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    try {
      await updateProject(projectId, {
        skillMode: form.skillMode,
        skillIds: Array.from(form.selectedSkillIds),
      });
      toast.success("Project skills saved");
      await loadProjects();
      router.refresh();
    } catch {
      toast.error("Failed to save project skills");
    } finally {
      setSavingSkills(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProject(projectId, {
        name: form.name,
        description: form.description,
        globalPrompt: form.globalPrompt,
        tools: Array.from(form.selectedTools),
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
        name: form.name,
        description: form.description,
        globalPrompt: form.globalPrompt,
        knowledgebaseId: form.selectedKbId,
        tools: Array.from(form.selectedTools),
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
    savingSettings,
    savingSkills,
    savingKb,
    handleSaveSkills,
    handleSaveSettings,
    handleSaveKb,
    onToggleTool,
    onBulkSelect,
  };
}

function useProjectDeletion(projectId: string) {
  const router = useRouter();
  const loadProjects = useAppStore((state) => state.loadProjects);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  return {
    deleting,
    showDeleteDialog,
    setShowDeleteDialog,
    handleDelete,
  };
}

function useProjectChats(projectId: string) {
  const allChats = useAppStore((state) => state.chats);
  const loadChats = useAppStore((state) => state.loadChats);
  const createNewChat = useCreateChat();
  const [searchQuery, setSearchQuery] = useState("");

  const chats = useMemo(() => {
    return Object.values(allChats).filter((c) => c.projectId === projectId);
  }, [allChats, projectId]);

  // Load project-specific chats on mount if not already loaded into store
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

  const handleNewChat = () => createNewChat("New Chat", projectId);

  return {
    searchQuery,
    setSearchQuery,
    filteredChats,
    handleNewChat,
  };
}

type ProjectPageTabsProps = {
  tab: string;
  onTabChange: (tab: string) => void;
  projectChats: ReturnType<typeof useProjectChats>;
  normalizedKnowledgebases: any[];
  editor: ReturnType<typeof useProjectEditor>;
  mcpServers: any[];
  skills: any[];
  deletion: ReturnType<typeof useProjectDeletion>;
};

function ProjectPageTabs(props: ProjectPageTabsProps) {
  const {
    tab,
    onTabChange,
    projectChats,
    normalizedKnowledgebases,
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
        <ProjectChatsTab
          searchQuery={projectChats.searchQuery}
          onSearchQueryChange={projectChats.setSearchQuery}
          filteredChats={projectChats.filteredChats}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="knowledge">
        <ProjectKnowledgebaseTab
          knowledgebases={normalizedKnowledgebases}
          selectedKbId={editor.form.selectedKbId}
          onSelectKbId={(val) =>
            editor.setForm((prev) => ({ ...prev, selectedKbId: val }))
          }
          onSave={editor.handleSaveKb}
          isSaving={editor.savingKb}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="prompt">
        <ProjectPromptTab
          globalPrompt={editor.form.globalPrompt}
          onGlobalPromptChange={(val) =>
            editor.setForm((prev) => ({ ...prev, globalPrompt: val }))
          }
          onSave={editor.handleSaveSettings}
          isSaving={editor.savingSettings}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="settings">
        <ProjectSettingsTab
          name={editor.form.name}
          onNameChange={(val) =>
            editor.setForm((prev) => ({ ...prev, name: val }))
          }
          description={editor.form.description}
          onDescriptionChange={(val) =>
            editor.setForm((prev) => ({ ...prev, description: val }))
          }
          onSave={editor.handleSaveSettings}
          isSaving={editor.savingSettings}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="tools">
        <ProjectToolsTab
          mcpServers={mcpServers}
          selectedTools={editor.form.selectedTools}
          onToggleTool={editor.onToggleTool}
          onBulkSelect={editor.onBulkSelect}
          onSave={editor.handleSaveSettings}
          isSaving={editor.savingSettings}
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
          description="Irreversible actions for this project."
          consequences="Deleting this project will permanently remove it. Chats will be dissociated but not deleted. This action cannot be undone."
          buttonLabel="Delete Project"
          onDelete={() => deletion.setShowDeleteDialog(true)}
          isDeleting={deletion.deleting}
        />
      </SidebarTabsContent>
    </SidebarTabs>
  );
}

function useProjectPageResources(projectId: string) {
  const projects = useAppStore((state) => state.projects);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);
  const { normalizedKnowledgebases } = useKnowledgebases();
  const { isLoading: hydrationLoading } = useResourceHydration([
    "projects",
    "mcpServers",
    "skills",
  ]);

  const project = projects.find((p) => p.id === projectId);
  const isLoading = hydrationLoading || (projects.length === 0 && !project);

  return {
    project,
    mcpServers,
    skills,
    normalizedKnowledgebases,
    isLoading,
  };
}

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
  const projectId = params.id as string;
  const { project, mcpServers, skills, normalizedKnowledgebases, isLoading } =
    useProjectPageResources(projectId);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("chats").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const editor = useProjectEditor(projectId, project);
  const deletion = useProjectDeletion(projectId);
  const projectChats = useProjectChats(projectId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    notFound();
  }

  return (
    <PageContainer className="space-y-6">
      <EntityDetailHeader
        icon={<FolderKanban className="h-8 w-8 text-primary" />}
        title={project.name}
        description={project.description}
        actionLabel="New Chat"
        actionIcon={<MessageSquarePlus className="h-4 w-4" />}
        onAction={projectChats.handleNewChat}
      />

      <ProjectPageTabs
        tab={tab}
        onTabChange={setTab}
        projectChats={projectChats}
        normalizedKnowledgebases={normalizedKnowledgebases}
        editor={editor}
        mcpServers={mcpServers}
        skills={skills}
        deletion={deletion}
      />

      <DeleteConfirmDialog
        isOpen={deletion.showDeleteDialog}
        onClose={() => deletion.setShowDeleteDialog(false)}
        onConfirm={deletion.handleDelete}
        title={`Delete "${project.name}"?`}
        description="This will permanently delete this project. Associated chats and data will remain accessible. This action cannot be undone."
        loading={deletion.deleting}
      />
    </PageContainer>
  );
}
