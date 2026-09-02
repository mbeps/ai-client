"use client";

import { BrainCircuit } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
  /** Optional additional CSS classes for the container. */
  className?: string;
  /** Whether the selector is disabled. */
  disabled?: boolean;
  /** Whether to show the selection trigger icon in the input. Defaults to true. */
  showTrigger?: boolean;
  /** Filter model list by runtime type (chat by default). */
  type?: "chat" | "embedding" | "both";
}

/**
 * A standalone, shared component for selecting AI models.
 * Decouples model selection logic from ChatInput and provides a consistent UI across the app.
 * Supports categorization of models by provider/type and indicates 'thinking' models with an icon.
 *
 * @param props - Selection state and behavior callbacks.
 * @returns A combobox for model selection with groups and 'thinking' badges.
 */
export function ModelSelector({
  value,
  onValueChange,
  className,
  disabled,
  showTrigger = true,
  type = "chat",
}: ModelSelectorProps) {
  const { models } = useUserModels(type);
  const [query, setQuery] = useState("");

  // Find the currently selected model object or default to the first available model
  const selectedModel = useMemo(
    () =>
      models.find((m) => m.id === value || m.modelId === value) ??
      models[0] ??
      null,
    [models, value],
  );

  const filteredModels = useMemo(() => {
    if (!query) return models;
    const lowerQuery = query.toLowerCase();
    return models.filter(
      (m) =>
        m.label.toLowerCase().includes(lowerQuery) ||
        m.providerName.toLowerCase().includes(lowerQuery),
    );
  }, [models, query]);

  // Group models by their defined provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, UserModelOption[]> = {};
    filteredModels.forEach((model) => {
      const provider = model.providerName;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
    });
    return groups;
  }, [filteredModels]);

  if (!selectedModel) {
    return (
      <Combobox
        items={[]}
        value={null}
        onValueChange={() => {}}
        itemToStringValue={() => ""}
        disabled
      >
        <ComboboxInput
          placeholder="No models configured"
          showTrigger={showTrigger}
          className={cn(
            "h-7 w-[200px] border-none bg-transparent text-muted-foreground text-xs shadow-none",
            className,
          )}
          showClear={false}
        />
      </Combobox>
    );
  }

  return (
    <Combobox
      items={filteredModels}
      value={selectedModel}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(val) =>
        val && onValueChange((val as UserModelOption).modelId)
      }
      itemToStringValue={(m) => (m as UserModelOption).label}
      disabled={disabled || models.length === 0}
    >
      <ComboboxInput
        placeholder={selectedModel.label}
        showTrigger={showTrigger}
        className={cn(
          "h-7 w-[200px] border-none bg-transparent text-muted-foreground text-xs shadow-none",
          className,
        )}
        showClear={false}
      />
      <ComboboxContent className="min-w-[220px]">
        <ComboboxEmpty>No models found.</ComboboxEmpty>
        <ComboboxList>
          {Object.entries(groupedModels).map(([provider, models]) => (
            <ComboboxGroup key={provider}>
              <ComboboxLabel className="font-semibold text-[10px] text-muted-foreground/70 capitalize tracking-wider">
                {provider}
              </ComboboxLabel>
              {models.map((m) => (
                <ComboboxItem key={m.id} value={m} className="p-0! text-xs">
                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <div className="flex w-full cursor-default items-center gap-2 px-2 py-1.5">
                        <span className="truncate">{m.label}</span>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="right"
                      align="start"
                      className="w-64 p-3"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-xs">
                            {m.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {m.providerName}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                            Context Window
                          </span>
                          <span className="text-xs">
                            {m.contextWindow.toLocaleString() ?? "Unknown"}{" "}
                            tokens (
                            {m.contextWindow
                              ? `${Math.round(m.contextWindow / 1000)}k`
                              : "?"}
                            )
                          </span>
                        </div>

                        {(m.capTools ||
                          m.capVision ||
                          m.capReasoning ||
                          m.capStructuredOutput) && (
                          <div className="flex flex-col gap-1.5">
                            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                              Capabilities
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {m.capTools ? (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 py-0 text-[10px] capitalize"
                                >
                                  tools
                                </Badge>
                              ) : null}
                              {m.capVision ? (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 py-0 text-[10px] capitalize"
                                >
                                  vision
                                </Badge>
                              ) : null}
                              {m.capReasoning ? (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 py-0 text-[10px] capitalize"
                                >
                                  reasoning
                                </Badge>
                              ) : null}
                              {m.capStructuredOutput ? (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 py-0 text-[10px] capitalize"
                                >
                                  structured output
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {m.capReasoning && (
                          <div className="mt-0.5 flex flex-col gap-1.5 border-border/50 border-t pt-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                              <BrainCircuit className="h-3 w-3 text-amber-500" />
                              Reasoning
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="h-4 border-amber-500/20 bg-amber-500/5 px-1.5 py-0 font-medium text-[10px] text-amber-600"
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
