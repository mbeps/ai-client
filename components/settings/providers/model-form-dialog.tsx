"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModel } from "@/lib/actions/models/create-model";
import { updateModel } from "@/lib/actions/models/update-model";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
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

type ModelFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AiProviderRow[];
  model?: AiModelRow | null;
  onSaved?: () => void;
};

export function ModelFormDialog({
  open,
  onOpenChange,
  providers,
  model,
  onSaved,
}: ModelFormDialogProps) {
  const isEdit = !!model;
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [modelType, setModelType] = useState<ModelType>("chat");
  const [contextWindow, setContextWindow] = useState("4096");
  const [embeddingDimensions, setEmbeddingDimensions] = useState("");
  const [capTools, setCapTools] = useState(false);
  const [capVision, setCapVision] = useState(false);
  const [capReasoning, setCapReasoning] = useState(false);
  const [capStructuredOutput, setCapStructuredOutput] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setProviderId(model?.providerId ?? providers[0]?.id ?? "");
    setModelId(model?.modelId ?? "");
    setLabel(model?.label ?? "");
    setModelType(toModelType(model?.modelType));
    setContextWindow(String(model?.contextWindow ?? 4096));
    setEmbeddingDimensions(
      model?.embeddingDimensions ? String(model.embeddingDimensions) : "",
    );
    setCapTools(model?.capTools ?? false);
    setCapVision(model?.capVision ?? false);
    setCapReasoning(model?.capReasoning ?? false);
    setCapStructuredOutput(model?.capStructuredOutput ?? false);
    setIsEnabled(model?.isEnabled ?? true);
  }, [open, model, providers]);

  const requiresEmbeddingDimension = useMemo(
    () => modelType === "embedding" || modelType === "both",
    [modelType],
  );

  const canSave =
    providerId.length > 0 &&
    modelId.trim().length > 0 &&
    label.trim().length > 0 &&
    !isSaving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;

    setIsSaving(true);
    try {
      const payload = {
        providerId,
        modelId: modelId.trim(),
        label: label.trim(),
        modelType,
        contextWindow: Number(contextWindow),
        embeddingDimensions:
          requiresEmbeddingDimension && embeddingDimensions.trim().length > 0
            ? Number(embeddingDimensions)
            : null,
        capTools,
        capVision,
        capReasoning,
        capStructuredOutput,
        isEnabled,
      };

      if (isEdit && model) {
        await updateModel(model.id, {
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
      } else {
        await createModel(payload);
        toast.success("Model created");
      }

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
              value={providerId}
              onValueChange={setProviderId}
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
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              placeholder="e.g. gpt-4o-mini"
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-label">Label</Label>
            <Input
              id="model-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Human-friendly label"
            />
          </div>

          <div className="space-y-2">
            <Label>Model Type</Label>
            <Select
              value={modelType}
              onValueChange={(value) => setModelType(toModelType(value))}
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
              value={contextWindow}
              onChange={(event) => setContextWindow(event.target.value)}
              type="number"
              min={1}
            />
          </div>

          {requiresEmbeddingDimension && (
            <div className="space-y-2">
              <Label htmlFor="embedding-dimensions">Embedding Dimensions</Label>
              <Input
                id="embedding-dimensions"
                value={embeddingDimensions}
                onChange={(event) => setEmbeddingDimensions(event.target.value)}
                placeholder="e.g. 1536"
                type="number"
                min={1}
              />
            </div>
          )}

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Tool Calling</Label>
              <Switch checked={capTools} onCheckedChange={setCapTools} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Vision</Label>
              <Switch checked={capVision} onCheckedChange={setCapVision} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Reasoning</Label>
              <Switch
                checked={capReasoning}
                onCheckedChange={setCapReasoning}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Structured Output</Label>
              <Switch
                checked={capStructuredOutput}
                onCheckedChange={setCapStructuredOutput}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create Model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
