"use client";

import { useAppStore } from "@/lib/store";
import { PROMPTS } from "@/constants/prompts";
import { useParams, useRouter, notFound } from "next/navigation";
import { Loader2, Command, Settings, Shield } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import {
  PromptForm,
  type PromptFormValues,
} from "@/components/prompt/prompt-form";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { updatePrompt } from "@/lib/actions/prompts/update-prompt";
import { deletePrompt } from "@/lib/actions/prompts/delete-prompt";
import { useQueryState, parseAsString } from "nuqs";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";

/**
 * Prompt editor page — client component for viewing and editing a single prompt.
 * Route parameter: `[id]` — Unique prompt identifier.
 * Features: edit title/shortcut/content, save changes, delete prompt, validation and error handling.
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
    parseAsString.withDefault("general").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const prompts = useAppStore((state) => state.prompts);
  const prompt = prompts.find((p) => p.id === promptId);
  const loadPrompts = useAppStore((state) => state.loadPrompts);

  const [loading, setLoading] = useState(prompts.length === 0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (prompts.length === 0) {
      loadPrompts().finally(() => setLoading(false));
    }
  }, [loadPrompts, prompts.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prompt) {
    notFound();
  }

  const handleSave = async (values: PromptFormValues) => {
    setSavingSettings(true);
    try {
      await updatePrompt(promptId, {
        title: values.title.trim(),
        shortcut: values.shortcut.trim(),
        content: values.content.trim(),
      });
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
      await deletePrompt(promptId);
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
    <div className="page-container max-w-4xl mx-auto py-8">
      <PageHeader
        icon={<Command className="h-8 w-8 text-primary" />}
        title={prompt.title}
        description={`Edit shortcut: ${prompt.shortcut}`}
      />

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Shield className="w-4 h-4 mr-2" />
            Danger Zone
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="general" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Prompt Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Modify the prompt title, shortcut, and expansion text.
            </p>
          </div>

          <PromptForm
            key={prompt.id}
            defaultValues={{
              title: prompt.title,
              shortcut: prompt.shortcut,
              content: prompt.content,
            }}
            onSubmit={handleSave}
            placeholderContent={
              PROMPTS.UI.EXAMPLES.PROMPT_CONTENT_PLACEHOLDER_EDIT
            }
            submitLabel="Save Changes"
            isSubmitting={savingSettings}
          />
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

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${prompt.title}"?`}
        description="This will permanently delete the prompt shortcut. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
