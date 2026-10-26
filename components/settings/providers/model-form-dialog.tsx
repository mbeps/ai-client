"use client";

import { Edit2, Loader2, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createModel } from "@/actions/models/create-model";
import { updateModels } from "@/actions/models/update-model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

const MODEL_TYPES = ["chat", "embedding", "both"] as const;
type ModelType = (typeof MODEL_TYPES)[number];

function toModelType(value: string | null | undefined): ModelType {
  if (value && MODEL_TYPES.includes(value as ModelType)) {
    return value as ModelType;
  }

  return "chat";
}

type ModelFormInitialState = {
  providerId: string;
  modelId: string;
  label: string;
  modelType: ModelType;
  contextWindow: string;
  embeddingDimensions: string;
  capTools: boolean;
  capVision: boolean;
  capReasoning: boolean;
  capStructuredOutput: boolean;
  isEnabled: boolean;
};

function buildInitialModelFormState(
  model: AiModelRow | null | undefined,
  providers: AiProviderRow[],
): ModelFormInitialState {
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
      isEnabled: true,
    };
  }

  return {
    providerId: model.providerId,
    modelId: model.modelId,
    label: model.label,
    modelType: toModelType(model.modelType),
    contextWindow: String(model.contextWindow),
    embeddingDimensions: model.embeddingDimensions
      ? String(model.embeddingDimensions)
      : "",
    capTools: Boolean(model.capTools),
    capVision: Boolean(model.capVision),
    capReasoning: Boolean(model.capReasoning),
    capStructuredOutput: Boolean(model.capStructuredOutput),
    isEnabled: Boolean(model.isEnabled),
  };
}

type ModelCapabilitySwitchesProps = {
  capTools: boolean;
  onCapToolsChange: (val: boolean) => void;
  capVision: boolean;
  onCapVisionChange: (val: boolean) => void;
  capReasoning: boolean;
  onCapReasoningChange: (val: boolean) => void;
  capStructuredOutput: boolean;
  onCapStructuredOutputChange: (val: boolean) => void;
  isEnabled: boolean;
  onIsEnabledChange: (val: boolean) => void;
};

function ModelCapabilitySwitches(props: ModelCapabilitySwitchesProps) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Tool Calling</Label>
        <Switch
          checked={props.capTools}
          onCheckedChange={props.onCapToolsChange}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Vision</Label>
        <Switch
          checked={props.capVision}
          onCheckedChange={props.onCapVisionChange}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Reasoning</Label>
        <Switch
          checked={props.capReasoning}
          onCheckedChange={props.onCapReasoningChange}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Structured Output</Label>
        <Switch
          checked={props.capStructuredOutput}
          onCheckedChange={props.onCapStructuredOutputChange}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Enabled</Label>
        <Switch
          checked={props.isEnabled}
          onCheckedChange={props.onIsEnabledChange}
        />
      </div>
    </div>
  );
}

type ModelFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AiProviderRow[];
  model?: AiModelRow | null;
  onSaved?: () => void;
};

type ModelSavePayload = {
  providerId: string;
  modelId: string;
  label: string;
  modelType: ModelType;
  contextWindow: number;
  embeddingDimensions: number | null;
  capTools: boolean;
  capVision: boolean;
  capReasoning: boolean;
  capStructuredOutput: boolean;
  isEnabled: boolean;
};

async function saveModelRecord(
  isEdit: boolean,
  model: AiModelRow | null | undefined,
  payload: ModelSavePayload,
): Promise<void> {
  if (isEdit && model) {
    await updateModels(model.id, {
      label: payload.label,
      modelType: payload.modelType,
      contextWindow: payload.contextWindow,
      embeddingDimensions: payload.embeddingDimensions,
      capTools: payload.capTools,
      capVision: payload.capVision,
      capReasoning: payload.capReasoning,
      capStructuredOutput: payload.capStructuredOutput,
      isEnabled: payload.isEnabled,
    });
    toast.success("Model updated");
    return;
  }
  await createModel(payload);
  toast.success("Model created");
}

function useModelForm(
  open: boolean,
  model: AiModelRow | null | undefined,
  providers: AiProviderRow[],
  onOpenChange: (open: boolean) => void,
  onSaved?: () => void,
) {
  const isEdit = Boolean(model);
  const [form, setForm] = useState<ModelFormInitialState>(() =>
    buildInitialModelFormState(model, providers),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialModelFormState(model, providers));
  }, [open, model, providers]);

  const requiresEmbeddingDimension =
    form.modelType === "embedding" || form.modelType === "both";

  const canSave =
    form.providerId.length > 0 &&
    form.modelId.trim().length > 0 &&
    form.label.trim().length > 0 &&
    !isSaving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const payload: ModelSavePayload = {
        providerId: form.providerId,
        modelId: form.modelId.trim(),
        label: form.label.trim(),
        modelType: form.modelType,
        contextWindow: Number(form.contextWindow),
        embeddingDimensions:
          requiresEmbeddingDimension &&
          form.embeddingDimensions.trim().length > 0
            ? Number(form.embeddingDimensions)
            : null,
        capTools: form.capTools,
        capVision: form.capVision,
        capReasoning: form.capReasoning,
        capStructuredOutput: form.capStructuredOutput,
        isEnabled: form.isEnabled,
      };

      await saveModelRecord(isEdit, model, payload);
      invalidateProviderRegistryCache();
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save model",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof ModelFormInitialState>(
    field: K,
    val: ModelFormInitialState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  return {
    isEdit,
    form,
    updateField,
    isSaving,
    canSave,
    handleSave,
    requiresEmbeddingDimension,
  };
}

/**
 * Modal dialog for creating or editing AI models within a provider.
 * Allows configuration of model name, ID, type (chat/embedding), and model-specific capabilities.
 *
 * @param props.open - Whether the dialog is visible.
 * @param props.onOpenChange - Callback to control dialog visibility.
 * @param props.providers - Available providers to assign the model to.
 * @param props.model - Optional existing model to edit; omit for create mode.
 * @param props.onSaved - Optional callback invoked after successful save.
 * @author Maruf Bepary
 */
export function ModelFormDialog({
  open,
  onOpenChange,
  providers,
  model,
  onSaved,
}: ModelFormDialogProps) {
  const {
    isEdit,
    form,
    updateField,
    isSaving,
    canSave,
    handleSave,
    requiresEmbeddingDimension,
  } = useModelForm(open, model, providers, onOpenChange, onSaved);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                <span>Edit Model</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span>Add Model</span>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure model capabilities and routing metadata for the selected
            provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={form.providerId}
              onValueChange={(val) => updateField("providerId", val)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-id">Model ID</Label>
            <Input
              id="model-id"
              value={form.modelId}
              onChange={(event) => updateField("modelId", event.target.value)}
              placeholder="e.g. gpt-4o-mini"
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-label">Label</Label>
            <Input
              id="model-label"
              value={form.label}
              onChange={(event) => updateField("label", event.target.value)}
              placeholder="Human-friendly label"
            />
          </div>

          <div className="space-y-2">
            <Label>Model Type</Label>
            <Select
              value={form.modelType}
              onValueChange={(value) =>
                updateField("modelType", toModelType(value))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">chat</SelectItem>
                <SelectItem value="embedding">embedding</SelectItem>
                <SelectItem value="both">both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context-window">Context Window</Label>
            <Input
              id="context-window"
              value={form.contextWindow}
              onChange={(event) =>
                updateField("contextWindow", event.target.value)
              }
              type="number"
              min={1}
            />
          </div>

          {requiresEmbeddingDimension && (
            <div className="space-y-2">
              <Label htmlFor="embedding-dimensions">Embedding Dimensions</Label>
              <Input
                id="embedding-dimensions"
                value={form.embeddingDimensions}
                onChange={(event) =>
                  updateField("embeddingDimensions", event.target.value)
                }
                placeholder="e.g. 1536"
                type="number"
                min={1}
              />
            </div>
          )}

          <ModelCapabilitySwitches
            capTools={form.capTools}
            onCapToolsChange={(val) => updateField("capTools", val)}
            capVision={form.capVision}
            onCapVisionChange={(val) => updateField("capVision", val)}
            capReasoning={form.capReasoning}
            onCapReasoningChange={(val) => updateField("capReasoning", val)}
            capStructuredOutput={form.capStructuredOutput}
            onCapStructuredOutputChange={(val) =>
              updateField("capStructuredOutput", val)
            }
            isEnabled={form.isEnabled}
            onIsEnabledChange={(val) => updateField("isEnabled", val)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Model
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
