"use client";

import { useMemo } from "react";
import { ModelDetailsHoverCard } from "@/components/shared/model-details-hover-card";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxFilterInput,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { type UserModelOption, useUserModels } from "@/hooks/use-user-models";
import { cn } from "@/lib/utils";

/**
 * Props for the ModelSelector component.
 */
interface ModelSelectorProps {
  /** The value (ID) of the currently selected model. */
  value: string;
  /** Callback invoked when the selection changes. */
  onValueChange: (value: string) => void;
  /** Optional additional CSS classes for the trigger. */
  className?: string;
  /** Whether the selector is disabled. */
  disabled?: boolean;
  /** Filter model list by runtime type (chat by default). */
  type?: "chat" | "embedding" | "both";
}

type ModelGroup = {
  provider: string;
  items: UserModelOption[];
};

/**
 * A standalone, shared component for selecting AI models.
 * Decouples model selection logic from ChatInput and provides a consistent UI across the app.
 *
 * The trigger displays the selected model and is not editable. Opening it shows a
 * popup with a filter input at the top and the models grouped by provider.
 * Hovering a model reveals its context window, capabilities, and reasoning support.
 *
 * @param props - Selection state and behavior callbacks.
 * @returns A read-only combobox trigger with a searchable, provider-grouped popup.
 */
export function ModelSelector({
  value,
  onValueChange,
  className,
  disabled,
  type = "chat",
}: ModelSelectorProps) {
  const { models } = useUserModels(type);
  const isEmpty = models.length === 0;

  const selectedModel = useMemo(
    () =>
      models.find((m) => m.id === value || m.modelId === value) ??
      models[0] ??
      null,
    [models, value],
  );

  const groupedModels = useMemo<ModelGroup[]>(() => {
    const groups = new Map<string, UserModelOption[]>();
    for (const model of models) {
      const existing = groups.get(model.providerName);
      if (existing) {
        existing.push(model);
      } else {
        groups.set(model.providerName, [model]);
      }
    }
    return Array.from(groups, ([provider, items]) => ({ provider, items }));
  }, [models]);

  return (
    <Combobox
      items={groupedModels}
      value={selectedModel}
      onValueChange={(val) =>
        val && onValueChange((val as UserModelOption).modelId)
      }
      itemToStringValue={(m) => (m as UserModelOption).label}
      disabled={disabled || isEmpty}
    >
      <ComboboxTrigger
        aria-label="Select model"
        className={cn(
          "flex h-7 w-[200px] cursor-default items-center justify-between gap-2 rounded-md border border-border/60 px-2 text-left text-xs transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
          className,
        )}
      >
        <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
          <ComboboxValue placeholder="No models configured" />
        </span>
      </ComboboxTrigger>

      <ComboboxContent className="w-64 p-0" side="top" align="start">
        <ComboboxFilterInput
          placeholder="Search models..."
          aria-label="Search models"
        />
        <ComboboxEmpty className="py-3">No models found.</ComboboxEmpty>
        <ComboboxList>
          {(group: ModelGroup) => (
            <ComboboxGroup key={group.provider} items={group.items}>
              <ComboboxLabel className="font-semibold text-[10px] text-muted-foreground/70 capitalize tracking-wider">
                {group.provider}
              </ComboboxLabel>
              <ComboboxCollection>
                {(model: UserModelOption) => (
                  <ComboboxItem
                    key={model.id}
                    value={model}
                    className="p-0! text-xs"
                  >
                    <ModelDetailsHoverCard model={model}>
                      <div className="flex w-full cursor-default items-center gap-2 px-2 py-1.5">
                        <span className="truncate">{model.label}</span>
                      </div>
                    </ModelDetailsHoverCard>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
