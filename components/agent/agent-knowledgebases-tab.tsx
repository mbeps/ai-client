"use client";

import { Database, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type KnowledgebaseWithCount,
  listKnowledgebases,
} from "@/actions/knowledgebases/list-knowledgebases";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Props for the AgentKnowledgebasesTab component.
 */
export interface AgentKnowledgebasesTabProps {
  selectedKbIds: string[];
  onToggleKb: (kbId: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
  knowledgebases?: KnowledgebaseWithCount[];
}

/**
 * Multi-select Knowledge Base attachment tab for an Agent.
 */
export function AgentKnowledgebasesTab({
  selectedKbIds,
  onToggleKb,
  onSave,
  isSaving = false,
  saveLabel = "Save Knowledge Bases",
  disabled = false,
  knowledgebases: propKnowledgebases,
}: AgentKnowledgebasesTabProps) {
  const [loadedKbs, setLoadedKbs] = useState<KnowledgebaseWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(!propKnowledgebases);

  useEffect(() => {
    if (propKnowledgebases) return;
    let active = true;
    listKnowledgebases()
      .then((res) => {
        if (active && res.ok) {
          setLoadedKbs(res.value);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [propKnowledgebases]);

  const knowledgebases = propKnowledgebases ?? loadedKbs;
  const selectedSet = new Set(selectedKbIds);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Knowledge Bases</h3>
        <p className="text-muted-foreground text-sm">
          Attach knowledge bases accessible to this agent in direct chats and
          isolated subagent runs.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading knowledge bases...
        </div>
      ) : knowledgebases.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          No knowledge bases found. Create one in Knowledge Bases first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {knowledgebases.map((kb) => {
            const checked = selectedSet.has(kb.id);
            return (
              <label
                key={kb.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => {
                    if (!disabled) onToggleKb(kb.id);
                  }}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Database className="text-primary h-4 w-4 shrink-0" />
                    <span className="truncate text-sm font-medium">
                      {kb.name}
                    </span>
                  </div>
                  {kb.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {kb.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {!disabled && (
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      )}
    </div>
  );
}
