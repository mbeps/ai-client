"use client";

import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  /** Allow clearing the selection back to empty string (for optional overrides). */
  allowClear?: boolean;
  /** Placeholder shown when no model is selected and allowClear is true. */
  placeholder?: string;
}

/**
 * Represents model group.
 *
 * @author Maruf Bepary
 */
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
  allowClear = false,
  placeholder,
}: ModelSelectorProps) {
  const { models, isLoading } = useUserModels(type);
  const isEmpty = !isLoading && models.length === 0;
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  // Portal inside the nearest dialog/sheet so Radix modal focus-trap doesn't block pointer/input events.
  const triggerRef = useCallback((el: HTMLElement | null) => {
    const dialog =
      (el?.closest('[role="dialog"]') as HTMLElement | null) ?? null;
    setPortalContainer((prev) => (prev === dialog ? prev : dialog));
  }, []);

  const selectedModel = useMemo(() => {
    const match = models.find((m) => m.id === value || m.modelId === value);
    if (match) return match;
    return allowClear ? null : (models[0] ?? null);
  }, [models, value, allowClear]);

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
    <div
      className={cn(
        "relative flex items-center",
        className?.includes("w-full") && "w-full",
      )}
    >
      <Combobox
        items={groupedModels}
        value={selectedModel}
        onValueChange={(val) =>
          onValueChange(val ? (val as UserModelOption).modelId : "")
        }
        itemToStringValue={(m) => (m as UserModelOption).label}
        disabled={disabled || isLoading || isEmpty}
      >
        <ComboboxTrigger
          ref={triggerRef}
          aria-label="Select model"
          className={cn(
            "border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring flex h-7 w-[200px] cursor-default items-center justify-between gap-2 rounded-full border px-2 text-left text-xs transition-colors focus-visible:ring-1 disabled:cursor-not-allowed",
            allowClear && selectedModel && "pr-7",
            className,
          )}
        >
          <span
            className={cn(
              "truncate",
              (isLoading || isEmpty || (!selectedModel && allowClear)) &&
                "text-muted-foreground",
            )}
          >
            <ComboboxValue
              placeholder={
                isLoading
                  ? "Loading models..."
                  : isEmpty
                    ? "No models configured"
                    : (placeholder ?? "Select model...")
              }
            />
          </span>
        </ComboboxTrigger>

        <ComboboxContent
          className="w-64 p-0"
          side="top"
          align="start"
          portalContainer={portalContainer}
        >
          <ComboboxFilterInput
            placeholder="Search models..."
            aria-label="Search models"
          />
          <ComboboxEmpty className="py-3">No models found.</ComboboxEmpty>
          <ComboboxList>
            {(group: ModelGroup) => (
              <ComboboxGroup key={group.provider} items={group.items}>
                <ComboboxLabel className="text-muted-foreground/70 text-[10px] font-semibold tracking-wider capitalize">
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
      {allowClear && selectedModel && !disabled && (
        <button
          type="button"
          aria-label="Clear model override"
          onClick={(e) => {
            e.stopPropagation();
            onValueChange("");
          }}
          className="text-muted-foreground hover:text-foreground absolute right-7 rounded-sm p-0.5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
