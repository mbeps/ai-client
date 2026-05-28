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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Model } from "@/types/model";
import { MODELS } from "@/constants/models";
import { BrainCircuit, Info, Sparkles } from "lucide-react";
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

  // Group models by their defined provider or fallback to the prefix in the value
  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};
    MODELS.forEach((model) => {
      const provider = model.provider || model.value.split("/")[0] || "Other";
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
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
          {Object.entries(groupedModels).map(([provider, models]) => (
            <ComboboxGroup key={provider}>
              <ComboboxLabel className="capitalize text-[10px] font-semibold tracking-wider text-muted-foreground/70">
                {provider}
              </ComboboxLabel>
              {models.map((m) => (
                <ComboboxItem key={m.value} value={m} className="text-xs p-0!">
                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <div className="flex w-full items-center gap-2 px-2 py-1.5 cursor-default">
                        <span className="truncate">{m.label}</span>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="right"
                      align="start"
                      className="w-64 p-3"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-semibold">
                              {m.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {m.provider}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Context Window
                          </span>
                          <span className="text-xs">
                            {m.contextWindow?.toLocaleString() ?? "Unknown"}{" "}
                            tokens (
                            {m.contextWindow
                              ? `${Math.round(m.contextWindow / 1000)}k`
                              : "?"}
                            )
                          </span>
                        </div>

                        {m.capabilities && m.capabilities.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Capabilities
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {m.capabilities.map((cap) => (
                                <Badge
                                  key={cap}
                                  variant="secondary"
                                  className="text-[10px] px-1 py-0 h-4 capitalize"
                                >
                                  {cap.replace("-", " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.isThinking && (
                          <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2.5 mt-0.5">
                            <div className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-medium text-muted-foreground">
                              <BrainCircuit className="h-3 w-3 text-amber-500" />
                              Reasoning
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-amber-500/20 text-amber-600 bg-amber-500/5 font-medium"
                              >
                                Enabled
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
