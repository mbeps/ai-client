"use client";

import {
  Binary,
  Braces,
  Brain,
  Cpu,
  Eye,
  MessageSquare,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

export const MODEL_TYPES = ["chat", "embedding", "both"] as const;
export type ModelType = (typeof MODEL_TYPES)[number];

export const MODEL_TYPE_OPTIONS: readonly {
  value: ModelType;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    value: "chat",
    label: "Chat",
    description: "Conversational generation, tool execution, and completions",
    icon: MessageSquare,
  },
  {
    value: "embedding",
    label: "Embedding",
    description: "Vector representations for semantic search and retrieval",
    icon: Binary,
  },
  {
    value: "both",
    label: "Both",
    description: "Supports chat completions and text embedding generation",
    icon: Sparkles,
  },
] as const;

export const CAPABILITY_CONFIG = [
  {
    key: "capTools" as const,
    label: "Tool Calling",
    description: "Supports function calls and tool integrations",
    icon: Wrench,
  },
  {
    key: "capVision" as const,
    label: "Vision",
    description: "Accepts multimodal image inputs and visual prompts",
    icon: Eye,
  },
  {
    key: "capReasoning" as const,
    label: "Reasoning",
    description: "Produces internal thinking traces and chain-of-thought",
    icon: Brain,
  },
  {
    key: "capStructuredOutput" as const,
    label: "Structured Output",
    description: "Guarantees strict JSON schema output matching",
    icon: Braces,
  },
] as const;

export type ModelFormState = {
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
 * Details Tab Component: Configures core identification and provider linkage.
 *
 * @author Maruf Bepary
 */
export function ModelDetailsTab({
  form,
  providers,
  isEdit,
  onChange,
}: {
  form: ModelFormState;
  providers: AiProviderRow[];
  isEdit: boolean;
  onChange: <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => void;
}) {
  const selectedProvider =
    providers.find((p) => p.id === form.providerId) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Model Details</h3>
        <p className="text-muted-foreground text-sm">
          Define the provider assignment, technical identifier, and display
          name.
        </p>
      </div>

      <div className="bg-muted/20 flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label
            htmlFor="model-enabled"
            className="cursor-pointer text-sm font-medium"
          >
            Enabled
          </Label>
          <p className="text-muted-foreground text-xs">
            Allow this model to be selected for chats, completions, and
            workflows.
          </p>
        </div>
        <Switch
          id="model-enabled"
          checked={form.isEnabled}
          onCheckedChange={(val) => onChange("isEnabled", val)}
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
              onChange("providerId", p.id);
            }
          }}
          itemToStringValue={(p) => (p as AiProviderRow).name}
          disabled={isEdit}
        >
          <ComboboxTrigger
            aria-label="Select provider"
            disabled={isEdit}
            className="border-input hover:bg-muted/50 focus-visible:ring-ring flex h-10 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-2 truncate">
              <Cpu className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">
                {selectedProvider ? selectedProvider.name : "Select provider"}
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
        {isEdit && (
          <p className="text-muted-foreground text-xs">
            Provider cannot be changed after model creation.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="model-id">Model ID</Label>
        <Input
          id="model-id"
          value={form.modelId}
          onChange={(event) => onChange("modelId", event.target.value)}
          placeholder="e.g. gpt-4o, claude-3-7-sonnet, gemini-2.5-pro"
          disabled={isEdit}
        />
        <p className="text-muted-foreground text-xs">
          The exact model string expected by the upstream provider API.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model-label">Display Label</Label>
        <Input
          id="model-label"
          value={form.label}
          onChange={(event) => onChange("label", event.target.value)}
          placeholder="e.g. Claude 3.7 Sonnet (Thinking)"
        />
        <p className="text-muted-foreground text-xs">
          A human-friendly name displayed throughout chat interfaces and
          pickers.
        </p>
      </div>
    </div>
  );
}

/**
 * Type Tab Component: Selects chat, embedding, or dual-purpose model type.
 *
 * @author Maruf Bepary
 */
export function ModelTypeTab({
  form,
  onChange,
}: {
  form: ModelFormState;
  onChange: <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Model Type</h3>
        <p className="text-muted-foreground text-sm">
          Select whether this model is used for text generation, embeddings, or
          both.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {MODEL_TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const isSelected = form.modelType === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange("modelType", value)}
              className={cn(
                "focus-visible:ring-ring flex cursor-pointer flex-col items-start gap-2.5 rounded-lg border p-4 text-left transition-all focus-visible:ring-1 focus-visible:outline-hidden",
                isSelected
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-5 shrink-0" />
                <span className="text-foreground text-sm font-semibold">
                  {label}
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-normal">
                {description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Context Tab Component: Specifies context window and embedding dimensions.
 *
 * @author Maruf Bepary
 */
export function ModelContextTab({
  form,
  onChange,
}: {
  form: ModelFormState;
  onChange: <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => void;
}) {
  const requiresEmbeddingDimension =
    form.modelType === "embedding" || form.modelType === "both";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Context & Dimensions</h3>
        <p className="text-muted-foreground text-sm">
          Configure maximum token capacity and vector representation dimensions.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="context-window">Context Window (Tokens)</Label>
        <Input
          id="context-window"
          value={form.contextWindow}
          onChange={(event) => onChange("contextWindow", event.target.value)}
          type="number"
          min={1}
          placeholder="e.g. 128000"
        />
        <p className="text-muted-foreground text-xs">
          Maximum combined prompt and completion token limit supported by this
          model.
        </p>
      </div>

      {requiresEmbeddingDimension ? (
        <div className="space-y-2">
          <Label htmlFor="embedding-dimensions">Embedding Dimensions</Label>
          <Input
            id="embedding-dimensions"
            value={form.embeddingDimensions}
            onChange={(event) =>
              onChange("embeddingDimensions", event.target.value)
            }
            placeholder="e.g. 1536"
            type="number"
            min={1}
          />
          <p className="text-muted-foreground text-xs">
            Output vector dimension size produced by this embedding model.
          </p>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
          Embedding dimensions are only applicable when Model Type is set to{" "}
          <span className="text-foreground font-medium">Embedding</span> or{" "}
          <span className="text-foreground font-medium">Both</span>.
        </div>
      )}
    </div>
  );
}

/**
 * Capabilities Tab Component: Toggles model capabilities.
 *
 * @author Maruf Bepary
 */
export function ModelCapabilitiesTab({
  form,
  onChange,
}: {
  form: ModelFormState;
  onChange: <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Capabilities</h3>
        <p className="text-muted-foreground text-sm">
          Select features and multimodal capabilities natively supported by this
          model.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAPABILITY_CONFIG.map(({ key, label, description, icon: Icon }) => {
          const isChecked = form[key];
          return (
            <button
              key={key}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => onChange(key, !isChecked)}
              className={cn(
                "focus-visible:ring-ring flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-all focus-visible:ring-1 focus-visible:outline-hidden",
                isChecked
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-5 shrink-0" />
                <span className="text-foreground text-sm font-medium">
                  {label}
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-normal">
                {description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Configuration Tab Component: Configures reasoning format and custom model JSON options.
 *
 * @author Maruf Bepary
 */
export function ModelConfigurationTab({
  form,
  onChange,
}: {
  form: ModelFormState;
  onChange: <K extends keyof ModelFormState>(
    field: K,
    val: ModelFormState[K],
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Configuration</h3>
        <p className="text-muted-foreground text-sm">
          Fine-tune reasoning parameter formats and custom JSON request
          overrides.
        </p>
      </div>

      <div className="bg-card space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="reasoning-effort-format">
            Reasoning Effort Format
          </Label>
          <Select
            value={form.reasoningEffortFormat}
            onValueChange={(val) =>
              onChange("reasoningEffortFormat", val as ReasoningEffortFormat)
            }
          >
            <SelectTrigger id="reasoning-effort-format" className="w-full">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                None / Automatic (No parameter)
              </SelectItem>
              <SelectItem value="openai">OpenAI (reasoning_effort)</SelectItem>
              <SelectItem value="openrouter">
                OpenRouter (reasoning.effort)
              </SelectItem>
              <SelectItem value="anthropic">
                Anthropic / LiteLLM (thinking.budget_tokens)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Controls the payload key used when forwarding reasoning effort to
            the model provider.
          </p>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="model-options">Custom Model Options (JSON)</Label>
          <Textarea
            id="model-options"
            value={form.modelOptions}
            onChange={(event) => onChange("modelOptions", event.target.value)}
            placeholder='e.g. {"enable_thinking": true, "temperature": 0.7}'
            className="font-mono text-xs"
            rows={5}
          />
          <p className="text-muted-foreground text-xs">
            Optional JSON key-value overrides merged directly into upstream API
            requests.
          </p>
        </div>
      </div>
    </div>
  );
}
