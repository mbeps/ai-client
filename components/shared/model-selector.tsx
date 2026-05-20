"use client";

import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxGroup,
  ComboboxLabel,
} from "@/components/ui/combobox";
import { Model } from "@/types/model";
import { MODELS } from "@/constants/models";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for the ModelSelector component.
 */
interface ModelSelectorProps {
  /** The value (ID) of the currently selected model. */
  value: string;
  /** Callback invoked when the selection changes. */
  onValueChange: (value: string) => void;
  /** Optional additional CSS classes for the container. */
  className?: string;
  /** Whether the selector is disabled. */
  disabled?: boolean;
  /** Whether to show the selection trigger icon in the input. Defaults to true. */
  showTrigger?: boolean;
}

/**
 * A standalone, shared component for selecting AI models.
 * Decouples model selection logic from ChatInput and provides a consistent UI across the app.
 * Supports categorization of models by provider/type and indicates 'thinking' models with an icon.
 *
 * @param props - Selection state and behavior callbacks.
 * @returns A combobox for model selection with groups and 'thinking' badges.
 * @author Maruf Bepary
 */
export function ModelSelector({
  value,
  onValueChange,
  className,
  disabled,
  showTrigger = true,
}: ModelSelectorProps) {
  // Find the currently selected model object or default to the first available model
  const selectedModel = useMemo(
    () => MODELS.find((m) => m.value === value) || MODELS[0],
    [value],
  );

  // Group models by their defined category or fallback to the provider prefix in the value
  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};
    MODELS.forEach((model) => {
      const category = model.category || model.value.split("/")[0] || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(model);
    });
    return groups;
  }, []);

  return (
    <Combobox
      items={MODELS}
      value={selectedModel}
      onValueChange={(val) => val && onValueChange((val as Model).value)}
      itemToStringValue={(m) => (m as Model).label}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={selectedModel.label}
        showTrigger={showTrigger}
        className={cn(
          "h-7 w-[200px] border-none bg-transparent shadow-none text-xs text-muted-foreground",
          className,
        )}
        showClear={false}
      />
      <ComboboxContent className="min-w-[220px]">
        <ComboboxEmpty>No models found.</ComboboxEmpty>
        <ComboboxList>
          {Object.entries(groupedModels).map(([category, models]) => (
            <ComboboxGroup key={category}>
              <ComboboxLabel className="capitalize text-[10px] font-semibold tracking-wider text-muted-foreground/70">
                {category}
              </ComboboxLabel>
              {models.map((m) => (
                <ComboboxItem key={m.value} value={m} className="text-xs">
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{m.label}</span>
                    {m.isThinking && (
                      <BrainCircuit className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                  </div>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
