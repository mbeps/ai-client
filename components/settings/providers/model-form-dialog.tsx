"use client";

import {
  Binary,
  Braces,
  Brain,
  Cpu,
  Edit2,
  Eye,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createModel } from "@/actions/models/create-model";
import { updateModels } from "@/actions/models/update-model";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxFilterInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import { cn } from "@/lib/utils";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

const MODEL_TYPES = ["chat", "embedding", "both"] as const;

/**
 * Represents model type.
 *
 * @author Maruf Bepary
 */
type ModelType = (typeof MODEL_TYPES)[number];

const MODEL_TYPE_OPTIONS = [
  {
    value: "chat" as const,
    label: "Chat",
    icon: MessageSquare,
  },
  {
    value: "embedding" as const,
    label: "Embedding",
    icon: Binary,
  },
  {
    value: "both" as const,
    label: "Both",
    icon: Sparkles,
  },
] as const;

const CAPABILITY_CONFIG = [
  {
    key: "capTools" as const,
    label: "Tool Calling",
    icon: Wrench,
  },
  {
    key: "capVision" as const,
    label: "Vision",
    icon: Eye,
  },
  {
    key: "capReasoning" as const,
    label: "Reasoning",
    icon: Brain,
  },
  {
    key: "capStructuredOutput" as const,
    label: "Structured Output",
    icon: Braces,
  },
] as const;

/**
 * Performs to model type.
 *
 * @param value - Target value
 * @returns The resolved result
 * @author Maruf Bepary
 */
function toModelType(value: string | null | undefined): ModelType {
  if (value && MODEL_TYPES.includes(value as ModelType)) {
    return value as ModelType;
  }

  return "chat";
}

/**
 * Represents model form initial state.
 *
 * @author Maruf Bepary
 */
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
  reasoningEffortFormat: ReasoningEffortFormat;
  modelOptions: string;
  isEnabled: boolean;
};

/**
 * Constructs initial model form state.
 *
 * @param model - Target model
 * @param providers - Target providers
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
      reasoningEffortFormat: "none",
      modelOptions: "",
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
    reasoningEffortFormat:
      (model.reasoningEffortFormat as ReasoningEffortFormat) ?? "none",
    modelOptions: model.modelOptions ?? "",
    isEnabled: Boolean(model.isEnabled),
  };
}

/**
 * Represents model capability cards props.
 *
 * @author Maruf Bepary
 */
type ModelCapabilityCardsProps = {
  capTools: boolean;
  onCapToolsChange: (val: boolean) => void;
  capVision: boolean;
  onCapVisionChange: (val: boolean) => void;
  capReasoning: boolean;
  onCapReasoningChange: (val: boolean) => void;
  capStructuredOutput: boolean;
  onCapStructuredOutputChange: (val: boolean) => void;
};

/**
 * Renders the 4 model capability toggle cards.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ModelCapabilityCards(props: ModelCapabilityCardsProps) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">Capabilities</Label>
        <p className="text-muted-foreground text-xs">
          Select features supported by this model
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAPABILITY_CONFIG.map(({ key, label, icon: Icon }) => {
          const isChecked = props[key];
          const toggle =
            key === "capTools"
              ? props.onCapToolsChange
              : key === "capVision"
                ? props.onCapVisionChange
                : key === "capReasoning"
                  ? props.onCapReasoningChange
                  : props.onCapStructuredOutputChange;

          return (
            <button
              key={key}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => toggle(!isChecked)}
              className={cn(
                "focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all focus-visible:ring-1 focus-visible:outline-hidden",
                isChecked
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="text-xs leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Represents model form dialog props.
 *
 * @author Maruf Bepary
 */
type ModelFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AiProviderRow[];
  model?: AiModelRow | null;
  onSaved?: () => void;
};

/**
 * Represents model save payload.
 *
 * @author Maruf Bepary
 */
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
  reasoningEffortFormat: ReasoningEffortFormat;
  modelOptions: Record<string, unknown> | null;
  isEnabled: boolean;
};

/**
 * Saves model record.
 *
 * @param isEdit - Target is edit
 * @param model - Target model
 * @param payload - Target payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function saveModelRecord(
  isEdit: boolean,
  model: AiModelRow | null | undefined,
  payload: ModelSavePayload,
): Promise<void> {
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
      throw new Error(res.error.message || "Failed to update model");
    }
    toast.success("Model updated");
    return;
  }
  const res = await createModel(payload);
  if (!res.ok) {
    throw new Error(res.error.message || "Failed to create model");
  }
  toast.success("Model created");
}

/**
 * Custom hook that provides use model form functionality.
 *
 * @param open - Target open
 * @param model - Target model
 * @param providers - Target providers
 * @param onOpenChange - Target on open change
 * @param onSaved - Target on saved
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
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
        reasoningEffortFormat: form.reasoningEffortFormat,
        modelOptions: parsedOptions,
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
 * Adaptive dialog/drawer for creating or editing AI models within a provider.
 * Switches to drawer on mobile viewports.
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

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === form.providerId) ?? null,
    [providers, form.providerId],
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
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
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Configure model capabilities and routing metadata for the selected
            provider.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-1 sm:max-h-[65vh] sm:px-0">
          <div className="bg-muted/20 flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label
                htmlFor="model-enabled"
                className="cursor-pointer text-sm font-medium"
              >
                Enabled
              </Label>
              <p className="text-muted-foreground text-xs">
                Allow this model to be used in chats and completions
              </p>
            </div>
            <Switch
              id="model-enabled"
              checked={form.isEnabled}
              onCheckedChange={(val) => updateField("isEnabled", val)}
            />
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Combobox
              items={providers}
              value={selectedProvider}
              onValueChange={(val) => {
                const p = val as AiProviderRow | null;
                if (p) {
                  updateField("providerId", p.id);
                }
              }}
              itemToStringValue={(p) => (p as AiProviderRow).name}
              disabled={isEdit}
            >
              <ComboboxTrigger
                aria-label="Select provider"
                disabled={isEdit}
                className="border-input hover:bg-muted/50 focus-visible:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2 truncate">
                  <Cpu className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate">
                    {selectedProvider
                      ? selectedProvider.name
                      : "Select provider"}
                  </span>
                </div>
              </ComboboxTrigger>
              <ComboboxContent className="w-(--anchor-width) min-w-[240px] p-0">
                <ComboboxFilterInput
                  placeholder="Search providers..."
                  aria-label="Search providers"
                />
                <ComboboxEmpty className="text-muted-foreground py-2.5 text-center text-xs">
                  No providers found.
                </ComboboxEmpty>
                <ComboboxList>
                  {(provider) => {
                    const p = provider as AiProviderRow;
                    return (
                      <ComboboxItem key={p.id} value={p}>
                        <Cpu className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </ComboboxItem>
                    );
                  }}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
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
            <div className="grid grid-cols-3 gap-2">
              {MODEL_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isSelected = form.modelType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => updateField("modelType", value)}
                    className={cn(
                      "focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all focus-visible:ring-1 focus-visible:outline-hidden",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="text-xs leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
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

          <ModelCapabilityCards
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
          />

          {form.capReasoning && (
            <div className="bg-muted/20 space-y-4 rounded-lg border p-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="reasoning-effort-format">
                  Reasoning Effort Format
                </Label>
                <Select
                  value={form.reasoningEffortFormat}
                  onValueChange={(val) =>
                    updateField(
                      "reasoningEffortFormat",
                      val as ReasoningEffortFormat,
                    )
                  }
                >
                  <SelectTrigger
                    id="reasoning-effort-format"
                    className="w-full"
                  >
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None / Automatic (No parameter)
                    </SelectItem>
                    <SelectItem value="openai">
                      OpenAI (reasoning_effort)
                    </SelectItem>
                    <SelectItem value="openrouter">
                      OpenRouter (reasoning.effort)
                    </SelectItem>
                    <SelectItem value="anthropic">
                      Anthropic / LiteLLM (thinking.budget_tokens)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Controls how reasoning effort parameters are sent to the
                  provider.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model-options">
                  Custom Model Options (JSON)
                </Label>
                <Textarea
                  id="model-options"
                  value={form.modelOptions}
                  onChange={(event) =>
                    updateField("modelOptions", event.target.value)
                  }
                  placeholder='e.g. {"enable_thinking": true}'
                  className="font-mono text-xs"
                  rows={3}
                />
                <p className="text-muted-foreground text-xs">
                  Optional JSON key-value overrides merged into completion
                  requests.
                </p>
              </div>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="px-4 pt-2 sm:px-0">
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
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
