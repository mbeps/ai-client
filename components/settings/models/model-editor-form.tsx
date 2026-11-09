"use client";

import {
  Binary,
  Layers,
  Save,
  Settings,
  Shield,
  Sliders,
  Sparkles,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { createModel } from "@/actions/models/create-model";
import { updateModels } from "@/actions/models/update-model";
import {
  ModelCapabilitiesTab,
  ModelConfigurationTab,
  ModelContextTab,
  ModelDetailsTab,
  type ModelFormState,
  ModelTypeTab,
} from "@/components/settings/models/model-tab-contents";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Constructs initial model form state from an existing model or defaults.
 *
 * @param model - Existing model if editing
 * @param providers - Available providers
 * @returns Initialized ModelFormState
 * @author Maruf Bepary
 */
export function buildInitialModelFormState(
  model: AiModelRow | null | undefined,
  providers: AiProviderRow[],
): ModelFormState {
  if (!model) {
    const firstProvider = providers[0];
    return {
      providerId: firstProvider ? firstProvider.id : "",
      modelId: "",
      label: "",
      modelType: "chat",
      contextWindow: "4096",
      embeddingDimensions: "",
      capTools: false,
      capVision: false,
      capReasoning: false,
      capStructuredOutput: false,
      reasoningEffortFormat: "none",
      modelOptions: "",
      isEnabled: true,
    };
  }

  return {
    providerId: model.providerId,
    modelId: model.modelId,
    label: model.label,
    modelType:
      model.modelType === "embedding" || model.modelType === "both"
        ? model.modelType
        : "chat",
    contextWindow: String(model.contextWindow),
    embeddingDimensions: model.embeddingDimensions
      ? String(model.embeddingDimensions)
      : "",
    capTools: Boolean(model.capTools),
    capVision: Boolean(model.capVision),
    capReasoning: Boolean(model.capReasoning),
    capStructuredOutput: Boolean(model.capStructuredOutput),
    reasoningEffortFormat:
      (model.reasoningEffortFormat as ReasoningEffortFormat) ?? "none",
    modelOptions: model.modelOptions ?? "",
    isEnabled: Boolean(model.isEnabled),
  };
}

export type ModelEditorFormProps = {
  model?: AiModelRow | null;
  providers: AiProviderRow[];
  onSuccess?: () => void;
  onRequestDelete?: () => void;
  isDeleting?: boolean;
};

/**
 * Model Editor Form component hosting the sidebar tabs:
 * Details, Type, Context, Capabilities, Configuration, and optional Danger Zone.
 * Uses Nuqs for state synchronization of the active tab.
 *
 * @author Maruf Bepary
 */
export function ModelEditorForm({
  model,
  providers,
  onSuccess,
  onRequestDelete,
  isDeleting = false,
}: ModelEditorFormProps) {
  const isEdit = Boolean(model);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [form, setForm] = useState<ModelFormState>(() =>
    buildInitialModelFormState(model, providers),
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const requiresEmbeddingDimension =
    form.modelType === "embedding" || form.modelType === "both";

  const canSave =
    form.providerId.trim().length > 0 &&
    form.modelId.trim().length > 0 &&
    form.label.trim().length > 0 &&
    !isSaving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;

    let parsedOptions: Record<string, unknown> | null = null;
    if (form.modelOptions.trim().length > 0) {
      try {
        const parsed = JSON.parse(form.modelOptions);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          toast.error("Model options must be a valid JSON object");
          return;
        }
        parsedOptions = parsed as Record<string, unknown>;
      } catch {
        toast.error("Invalid JSON format in Model Options");
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        providerId: form.providerId,
        modelId: form.modelId.trim(),
        label: form.label.trim(),
        modelType: form.modelType,
        contextWindow: Number(form.contextWindow) || 4096,
        embeddingDimensions:
          requiresEmbeddingDimension &&
          form.embeddingDimensions.trim().length > 0
            ? Number(form.embeddingDimensions)
            : null,
        capTools: form.capTools,
        capVision: form.capVision,
        capReasoning: form.capReasoning,
        capStructuredOutput: form.capStructuredOutput,
        reasoningEffortFormat: form.reasoningEffortFormat,
        modelOptions: parsedOptions,
        isEnabled: form.isEnabled,
      };

      if (isEdit && model) {
        const res = await updateModels(model.id, {
          label: payload.label,
          modelType: payload.modelType,
          contextWindow: payload.contextWindow,
          embeddingDimensions: payload.embeddingDimensions,
          capTools: payload.capTools,
          capVision: payload.capVision,
          capReasoning: payload.capReasoning,
          capStructuredOutput: payload.capStructuredOutput,
          reasoningEffortFormat: payload.reasoningEffortFormat,
          modelOptions: payload.modelOptions,
          isEnabled: payload.isEnabled,
        });

        if (!res.ok) {
          toast.error(res.error.message || "Failed to update model");
          return;
        }
        toast.success("Model updated");
      } else {
        const res = await createModel(payload);
        if (!res.ok) {
          toast.error(res.error.message || "Failed to create model");
          return;
        }
        toast.success("Model created");
      }

      invalidateProviderRegistryCache();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save model",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
      <SidebarTabsList>
        <SidebarTabsTrigger value="details">
          <Settings className="mr-2 h-4 w-4" />
          <span>Details</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="type">
          <Binary className="mr-2 h-4 w-4" />
          <span>Type</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="context">
          <Layers className="mr-2 h-4 w-4" />
          <span>Context</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="capabilities">
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Capabilities</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="configuration">
          <Sliders className="mr-2 h-4 w-4" />
          <span>Configuration</span>
        </SidebarTabsTrigger>
        {isEdit && onRequestDelete && (
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        )}
      </SidebarTabsList>

      <div className="flex-1 space-y-6">
        <SidebarTabsContent value="details">
          <ModelDetailsTab
            form={form}
            providers={providers}
            isEdit={isEdit}
            onChange={updateField}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="type">
          <ModelTypeTab form={form} onChange={updateField} />
        </SidebarTabsContent>

        <SidebarTabsContent value="context">
          <ModelContextTab form={form} onChange={updateField} />
        </SidebarTabsContent>

        <SidebarTabsContent value="capabilities">
          <ModelCapabilitiesTab form={form} onChange={updateField} />
        </SidebarTabsContent>

        <SidebarTabsContent value="configuration">
          <ModelConfigurationTab form={form} onChange={updateField} />
        </SidebarTabsContent>

        {isEdit && onRequestDelete && (
          <SidebarTabsContent value="danger">
            <DangerZoneCard
              title="Danger Zone"
              description="Irreversible actions for this model."
              consequences="Deleting this model will permanently remove it from your available models and providers. This action cannot be undone."
              buttonLabel="Delete Model"
              onDelete={onRequestDelete}
              isDeleting={isDeleting}
            />
          </SidebarTabsContent>
        )}

        {/* Global Save Button for non-danger tabs */}
        {tab !== "danger" && (
          <div className="flex items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} disabled={!canSave}>
              <LoadingSwap isLoading={isSaving}>
                <div className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? "Save Changes" : "Create Model"}
                </div>
              </LoadingSwap>
            </Button>
          </div>
        )}
      </div>
    </SidebarTabs>
  );
}
