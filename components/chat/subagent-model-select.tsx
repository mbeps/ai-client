"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type UserModelOption, useUserModels } from "@/hooks/use-user-models";
import { cn } from "@/lib/utils";

interface SubagentModelSelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

type ModelGroup = {
  provider: string;
  items: UserModelOption[];
};

const INHERIT_VALUE = "__inherit__";

const INHERIT_OPTION: UserModelOption = {
  id: INHERIT_VALUE,
  modelId: INHERIT_VALUE,
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
 * Native Shadcn/Radix UI Select component for choosing worker subagent models.
 * Replaces Combobox inside Dialogs to avoid modal focus trap and overlay conflicts.
 *
 * @author Maruf Bepary
 */
export function SubagentModelSelect({
  value,
  onValueChange,
  disabled = false,
  className,
}: SubagentModelSelectProps) {
  const { models, isLoading } = useUserModels("chat");

  const selectedValue = useMemo(() => {
    if (!value || value === INHERIT_VALUE) {
      return INHERIT_VALUE;
    }
    const match = models.find((m) => m.id === value || m.modelId === value);
    return match ? match.modelId : INHERIT_VALUE;
  }, [models, value]);

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
    <Select
      value={selectedValue}
      onValueChange={(val) => {
        if (!val || val === INHERIT_VALUE) {
          onValueChange(undefined);
        } else {
          onValueChange(val);
        }
      }}
      disabled={disabled || isLoading}
    >
      <SelectTrigger
        aria-label="Select worker subagent model"
        className={cn("h-9 w-full text-xs", className)}
      >
        <SelectValue
          placeholder={
            isLoading ? "Loading models..." : "Inherit Main Model (Default)"
          }
        />
      </SelectTrigger>

      <SelectContent>
        <SelectItem
          value={INHERIT_VALUE}
          className="text-xs font-medium text-purple-600 dark:text-purple-400"
        >
          {INHERIT_OPTION.label}
        </SelectItem>

        {groupedModels.map((group) => (
          <SelectGroup key={group.provider}>
            <SelectLabel className="capitalize font-semibold text-[10px] text-muted-foreground/70 tracking-wider">
              {group.provider}
            </SelectLabel>
            {group.items.map((model) => (
              <SelectItem
                key={model.id}
                value={model.modelId}
                className="text-xs"
              >
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

// Backward compatibility alias
export { SubagentModelSelect as SubagentModelCombobox };
