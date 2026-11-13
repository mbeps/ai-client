"use client";

import { Loader2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type KnowledgebaseWithCount,
  listKnowledgebases,
} from "@/actions/knowledgebases/list-knowledgebases";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

/**
 * Props for the AgentKnowledgebasesTab component.
 */
export interface AgentKnowledgebasesTabProps {
  selectedKbIds: string[];
  onToggleKb?: (kbId: string) => void;
  onSelectKbIds?: (ids: string[]) => void;
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
  onSelectKbIds,
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

  const handleSelect = (ids: Set<string>) => {
    if (disabled) return;
    if (onSelectKbIds) {
      onSelectKbIds(Array.from(ids));
      return;
    }
    const nextIds = Array.from(ids);
    for (const id of nextIds) {
      if (!selectedSet.has(id)) onToggleKb?.(id);
    }
    for (const id of selectedKbIds) {
      if (!ids.has(id)) onToggleKb?.(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Knowledge Bases</h3>
          <p className="text-muted-foreground text-sm">
            Attach knowledge bases accessible to this agent in direct chats and
            isolated subagent runs.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={ROUTES.KNOWLEDGEBASES.new}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Knowledgebase
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading knowledge bases...
        </div>
      ) : (
        <div
          className={disabled ? "pointer-events-none opacity-60" : undefined}
        >
          <KnowledgebasePicker
            knowledgebases={knowledgebases.map((kb) => ({
              ...kb,
              description: kb.description ?? undefined,
            }))}
            mode="multiple"
            selectedIds={selectedSet}
            onSelect={handleSelect}
            className="w-full"
          />
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
