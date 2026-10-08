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

interface SubagentModelComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

type ModelGroup = {
  provider: string;
  items: UserModelOption[];
};

const INHERIT_OPTION: UserModelOption = {
  id: "__inherit__",
  modelId: "__inherit__",
  label: "Inherit Main Model (Default)",
  providerName: "Default",
  providerId: "default",
  modelType: "chat",
  contextWindow: 0,
  embeddingDimensions: null,
  capTools: true,
  capVision: true,
  capReasoning: false,
  capStructuredOutput: true,
  isEnabled: true,
  providerIsEnabled: true,
};

/**
 * Shadcn UI Combobox for choosing the worker subagent model.
 * Includes an option to inherit the main orchestrator's model.
 *
 * @author Maruf Bepary
 */
export function SubagentModelCombobox({
  value,
  onValueChange,
  disabled = false,
  className,
}: SubagentModelComboboxProps) {
  const { models, isLoading } = useUserModels("chat");

  const selectedModel = useMemo<UserModelOption>(() => {
    if (!value || value === "__inherit__") {
      return INHERIT_OPTION;
    }
    return (
      models.find((m) => m.id === value || m.modelId === value) ??
      INHERIT_OPTION
    );
  }, [models, value]);

  const groupedModels = useMemo<ModelGroup[]>(() => {
    const groups = new Map<string, UserModelOption[]>();

    // Always include Default / Inherit at the top
    groups.set("Default", [INHERIT_OPTION]);

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
      onValueChange={(val) => {
        const option = val as UserModelOption | null;
        if (!option || option.id === "__inherit__") {
          onValueChange(undefined);
        } else {
          onValueChange(option.modelId);
        }
      }}
      itemToStringValue={(m) => (m as UserModelOption).label}
      disabled={disabled || isLoading}
    >
      <ComboboxTrigger
        aria-label="Select worker subagent model"
        className={cn(
          "flex h-8 w-full cursor-default items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
          className,
        )}
      >
        <span className="truncate">
          <ComboboxValue
            placeholder={
              isLoading ? "Loading models..." : "Inherit Main Model (Default)"
            }
          />
        </span>
      </ComboboxTrigger>

      <ComboboxContent
        className="w-[320px] max-w-full p-0"
        side="bottom"
        align="start"
      >
        <ComboboxFilterInput
          placeholder="Search worker models..."
          aria-label="Search worker models"
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
                    {model.id === "__inherit__" ? (
                      <div className="flex w-full cursor-default items-center gap-2 px-2.5 py-1.5 font-medium text-purple-600 dark:text-purple-400">
                        <span className="truncate">{model.label}</span>
                      </div>
                    ) : (
                      <ModelDetailsHoverCard model={model}>
                        <div className="flex w-full cursor-default items-center gap-2 px-2.5 py-1.5">
                          <span className="truncate">{model.label}</span>
                        </div>
                      </ModelDetailsHoverCard>
                    )}
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
