"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Command,
  FileText,
  Globe,
  Loader2,
  Settings,
  Shield,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { deletePrompt } from "@/actions/prompts/delete-prompt";
import { updatePrompt } from "@/actions/prompts/update-prompt";
import { PageHeader } from "@/components/page-header";
import { PromptContentTab } from "@/components/prompt/prompt-content-tab";
import { PromptDetailsTab } from "@/components/prompt/prompt-details-tab";
import {
  type PromptFormValues,
  promptFormSchema,
} from "@/components/prompt/prompt-form";
import { PromptScopeTab } from "@/components/prompt/prompt-scope-tab";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Form } from "@/components/ui/form";
import { PROMPTS } from "@/config/prompts";
import { ROUTES } from "@/config/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Prompt editor page — client component for viewing and editing a single prompt.
 * Route parameter: `[id]` — Unique prompt identifier.
 * Features: tabs for prompt details, content, scope, and danger zone.
 * Shows 404 if prompt not found.
 *
 * @author Maruf Bepary
 * @see PromptsPage for parent prompts list
 */
export default function PromptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const promptId = params.id as string;

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const prompts = useAppStore((state) => state.prompts);
  const prompt = prompts.find((p) => p.id === promptId);
  const loadPrompts = useAppStore((state) => state.loadPrompts);

  useResourceHydration(["projects", "assistants", "prompts"]);

  const [loading, setLoading] = useState(prompts.length === 0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      title: "",
      shortcut: "",
      content: "",
      scope: "global",
      projectId: null,
      assistantId: null,
    },
  });

  // Sync form state when prompt is available or changes
  useEffect(() => {
    if (prompt) {
      form.reset({
        title: prompt.title,
        shortcut: prompt.shortcut,
        content: prompt.content,
        projectId: prompt.projectId,
        assistantId: prompt.assistantId,
        scope: prompt.projectId
          ? "project"
          : prompt.assistantId
            ? "assistant"
            : "global",
      });
    }
  }, [prompt, form]);

  useEffect(() => {
    if (prompts.length === 0) {
      loadPrompts().finally(() => setLoading(false));
    }
  }, [loadPrompts, prompts.length]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!prompt) {
    notFound();
  }

  const handleSave = async (values: PromptFormValues) => {
    setSavingSettings(true);
    try {
      const res = await updatePrompt(promptId, {
        title: values.title.trim(),
        shortcut: values.shortcut.trim(),
        content: values.content.trim(),
        projectId: values.scope === "project" ? values.projectId : null,
        assistantId: values.scope === "assistant" ? values.assistantId : null,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to save prompt");
        return;
      }
      toast.success("Prompt saved");
      await loadPrompts();
      router.refresh();
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deletePrompt(promptId);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to delete prompt");
        setDeleting(false);
        return;
      }
      toast.success("Prompt deleted");
      await loadPrompts();
      router.refresh();
      router.push(ROUTES.SETTINGS.PROMPTS.path);
    } catch {
      toast.error("Failed to delete prompt");
      setDeleting(false);
    }
  };

  return (
    <PageContainer variant="default">
      <PageHeader
        icon={<Command className="text-primary h-8 w-8" />}
        title={prompt.title}
        description={`Edit shortcut: ${prompt.shortcut}`}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)}>
          <SidebarTabs
            value={tab}
            onValueChange={setTab}
            className="mt-6 w-full"
          >
            <SidebarTabsList>
              <SidebarTabsTrigger value="details">
                <Settings className="mr-2 h-4 w-4" />
                Details
              </SidebarTabsTrigger>
              <SidebarTabsTrigger value="content">
                <FileText className="mr-2 h-4 w-4" />
                Prompt
              </SidebarTabsTrigger>
              <SidebarTabsTrigger value="scope">
                <Globe className="mr-2 h-4 w-4" />
                Scope
              </SidebarTabsTrigger>
              <SidebarTabsTrigger value="danger">
                <Shield className="mr-2 h-4 w-4" />
                Danger Zone
              </SidebarTabsTrigger>
            </SidebarTabsList>

            <SidebarTabsContent value="details">
              <PromptDetailsTab form={form} isSubmitting={savingSettings} />
            </SidebarTabsContent>

            <SidebarTabsContent value="content">
              <PromptContentTab
                form={form}
                placeholderContent={
                  PROMPTS.UI.EXAMPLES.PROMPT_CONTENT_PLACEHOLDER_EDIT
                }
                isSubmitting={savingSettings}
              />
            </SidebarTabsContent>

            <SidebarTabsContent value="scope">
              <PromptScopeTab form={form} isSubmitting={savingSettings} />
            </SidebarTabsContent>

            <SidebarTabsContent value="danger">
              <DangerZoneCard
                title="Danger Zone"
                description="Irreversible actions for this prompt."
                consequences="Deleting this prompt will permanently remove it from your shortcuts. This action cannot be undone."
                buttonLabel="Delete Prompt"
                onDelete={() => setShowDeleteDialog(true)}
                isDeleting={deleting}
              />
            </SidebarTabsContent>
          </SidebarTabs>
        </form>
      </Form>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${prompt.title}"?`}
        description="This will permanently delete the prompt shortcut. This cannot be undone."
        loading={deleting}
      />
    </PageContainer>
  );
}
