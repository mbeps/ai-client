"use client";

import {
  Bot,
  BrainCircuit,
  ChevronLeft,
  FileText,
  Loader2,
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
import { createAssistant } from "@/actions/assistants/create-assistant";
import { AssistantPromptTab } from "@/components/assistant/assistant-prompt-tab";
import { AssistantSettingsTab } from "@/components/assistant/assistant-settings-tab";
import { AssistantToolsTab } from "@/components/assistant/assistant-tools-tab";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { ROUTES } from "@/config/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store/use-app-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";
import type { SkillMode } from "@/schemas/skill/skill-config";

/**
 * Represents form state for new assistant creation.
 *
 * @author Maruf Bepary
 */
type AssistantCreateFormState = {
  name: string;
  description: string;
  prompt: string;
  selectedTools: Set<string>;
  skillMode: SkillMode;
  selectedSkillIds: Set<string>;
  promptMode: "all" | "none" | "specific";
  selectedPromptIds: Set<string>;
};

/**
 * Dedicated page for creating a new custom AI assistant.
 * Provides a full tabbed configuration layout (Settings, Prompt, Tools, Skills)
 * replacing the previous modal dialog.
 *
 * @author Maruf Bepary
 */
export default function NewAssistantPage() {
  const router = useRouter();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const skills = useAppStore((state) => state.skills);
  const loadAssistants = useAppStore((state) => state.loadAssistants);

  const { isLoading: hydrationLoading } = useResourceHydration([
    "assistants",
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

  const [form, setForm] = useState<AssistantCreateFormState>({
    name: "",
    description: "",
    prompt: "",
    selectedTools: new Set<string>(),
    skillMode: "dynamic",
    selectedSkillIds: new Set<string>(),
    promptMode: "all",
    selectedPromptIds: new Set<string>(),
  });

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Assistant name is required");
      setTab("settings");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createAssistant({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        prompt: form.prompt.trim() || undefined,
        tools: Array.from(form.selectedTools),
        skillMode: form.skillMode,
        skillIds: Array.from(form.selectedSkillIds),
        promptMode: form.promptMode,
        promptIds: Array.from(form.selectedPromptIds),
      });

      if (!res.ok) {
        toast.error(res.error.message || "Failed to create assistant");
        return;
      }

      toast.success("Assistant created");
      await loadAssistants();
      router.push(ROUTES.ASSISTANTS.detail(res.value.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create assistant",
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
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer variant="default">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-foreground mb-4 -ml-2 transition-colors"
      >
        <Link href={ROUTES.ASSISTANTS.path}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Assistants
        </Link>
      </Button>

      <PageHeader
        icon={<Bot className="text-primary h-8 w-8" />}
        title="New Assistant"
        description="Configure a new AI assistant with a custom persona, prompt, default tools, and skills."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild disabled={isCreating}>
              <Link href={ROUTES.ASSISTANTS.path}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              <LoadingSwap isLoading={isCreating}>
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Assistant
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
          <AssistantSettingsTab
            name={form.name}
            onNameChange={(val) => setForm((prev) => ({ ...prev, name: val }))}
            description={form.description}
            onDescriptionChange={(val) =>
              setForm((prev) => ({ ...prev, description: val }))
            }
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Assistant"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <AssistantPromptTab
            prompt={form.prompt}
            onPromptChange={(val) =>
              setForm((prev) => ({ ...prev, prompt: val }))
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
            saveLabel="Create Assistant"
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="tools">
          <AssistantToolsTab
            mcpServers={mcpServers}
            selectedTools={form.selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
            onSave={handleCreate}
            isSaving={isCreating}
            saveLabel="Create Assistant"
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
            saveLabel="Create Assistant"
          />
        </SidebarTabsContent>
      </SidebarTabs>
    </PageContainer>
  );
}
