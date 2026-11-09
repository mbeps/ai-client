"use client";

import {
  BrainCircuit,
  ChevronLeft,
  FileText,
  FolderKanban,
  Library,
  Plus,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { createProject } from "@/actions/projects/create-project";
import { PageHeader } from "@/components/page-header";
import { ProjectKnowledgebaseTab } from "@/components/project/project-knowledgebase-tab";
import { ProjectPromptTab } from "@/components/project/project-prompt-tab";
import { ProjectSettingsTab } from "@/components/project/project-settings-tab";
import { ProjectToolsTab } from "@/components/project/project-tools-tab";
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
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store/use-app-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";
import type { SkillMode } from "@/schemas/skill/skill-config";

/**
 * Represents form state for new project creation.
 *
 * @author Maruf Bepary
 */
type ProjectCreateFormState = {
  name: string;
  description: string;
  globalPrompt: string;
  selectedTools: Set<string>;
  skillMode: SkillMode;
  selectedSkillIds: Set<string>;
  promptMode: "all" | "none" | "specific";
  selectedPromptIds: Set<string>;
  selectedKbId: string | null;
};

/**
 * Dedicated page for creating a new Project workspace.
 * Provides a full tabbed configuration layout (Settings, Knowledge, Prompt, Tools, Skills)
 * replacing the previous modal dialog.
 *
 * @author Maruf Bepary
 */
export default function NewProjectPage() {
  const router = useRouter();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);
  const loadProjects = useAppStore((state) => state.loadProjects);
  const { normalizedKnowledgebases } = useKnowledgebases();

  const { isLoading: hydrationLoading } = useResourceHydration([
    "projects",
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

  const [form, setForm] = useState<ProjectCreateFormState>({
    name: "",
    description: "",
    globalPrompt: "",
    selectedTools: new Set<string>(),
    skillMode: "dynamic",
    selectedSkillIds: new Set<string>(),
    promptMode: "all",
    selectedPromptIds: new Set<string>(),
    selectedKbId: null,
  });

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Project name is required");
      setTab("settings");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        globalPrompt: form.globalPrompt.trim() || undefined,
        tools: Array.from(form.selectedTools),
        skillMode: form.skillMode,
        skillIds: Array.from(form.selectedSkillIds),
        promptMode: form.promptMode,
        promptIds: Array.from(form.selectedPromptIds),
        knowledgebaseId: form.selectedKbId,
      });

      if (!res.ok) {
        toast.error(res.error.message || "Failed to create project");
        return;
      }

      toast.success("Project created");
      await loadProjects();
      router.push(ROUTES.PROJECTS.detail(res.value.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project",
      );
    } finally {
      setIsCreating(false);
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

  if (hydrationLoading) {
    return <EntityDetailSkeleton />;
  }

  return (
    <PageContainer variant="default">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-foreground mb-4 -ml-2 transition-colors"
      >
        <Link href={ROUTES.PROJECTS.path}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Projects
        </Link>
      </Button>

      <PageHeader
        icon={<FolderKanban className="text-primary h-8 w-8" />}
        title="New Project"
        description="Configure a new project workspace to organize chats, prompts, knowledge bases, and tools."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild disabled={isCreating}>
              <Link href={ROUTES.PROJECTS.path}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              <LoadingSwap isLoading={isCreating}>
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </div>
              </LoadingSwap>
            </Button>
          </div>
        }
      />

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledge">
            <Library className="mr-2 h-4 w-4" />
            <span>Knowledge</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="prompt">
            <FileText className="mr-2 h-4 w-4" />
            <span>Prompt</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            <span>Tools</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="skills">
            <BrainCircuit className="mr-2 h-4 w-4" />
            <span>Skills</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="settings">
          <ProjectSettingsTab
            name={form.name}
            onNameChange={(val) => setForm((prev) => ({ ...prev, name: val }))}
            description={form.description}
            onDescriptionChange={(val) =>
              setForm((prev) => ({ ...prev, description: val }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Project"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="knowledge">
          <ProjectKnowledgebaseTab
            knowledgebases={normalizedKnowledgebases}
            selectedKbId={form.selectedKbId}
            onSelectKbId={(val) =>
              setForm((prev) => ({ ...prev, selectedKbId: val }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Project"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <ProjectPromptTab
            globalPrompt={form.globalPrompt}
            onGlobalPromptChange={(val) =>
              setForm((prev) => ({ ...prev, globalPrompt: val }))
            }
            promptMode={form.promptMode}
            onPromptModeChange={(val) =>
              setForm((prev) => ({ ...prev, promptMode: val }))
            }
            selectedPromptIds={form.selectedPromptIds}
            onTogglePromptId={(id) =>
              setForm((prev) => ({
                ...prev,
                selectedPromptIds: toggleSetItem(prev.selectedPromptIds, id),
              }))
            }
            onSelectPromptIds={(ids) =>
              setForm((prev) => ({
                ...prev,
                selectedPromptIds: ids,
              }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Project"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="tools">
          <ProjectToolsTab
            mcpServers={mcpServers}
            selectedTools={form.selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Project"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="skills">
          <SkillsConfigTab
            skillMode={form.skillMode}
            onSkillModeChange={(val) =>
              setForm((prev) => ({ ...prev, skillMode: val }))
            }
            selectedSkillIds={form.selectedSkillIds}
            onToggleSkill={(id) =>
              setForm((prev) => ({
                ...prev,
                selectedSkillIds: toggleSetItem(prev.selectedSkillIds, id),
              }))
            }
            onSelectSkills={(ids) =>
              setForm((prev) => ({ ...prev, selectedSkillIds: ids }))
            }
            skills={skills}
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Project"
          />
        </SidebarTabsContent>
      </SidebarTabs>
    </PageContainer>
  );
}
