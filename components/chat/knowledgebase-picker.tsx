"use client";

import {
  AlertTriangle,
  CheckSquare,
  Database,
  Loader2,
  Search,
  Square,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PickerDialog } from "@/components/chat/picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

interface KnowledgebasePickerProps {
  knowledgebases: Knowledgebase[];
  mode?: "single" | "multiple";
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  className?: string;
  maxHeight?: string;
  showIcons?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

/**
 * Core picker component for selecting knowledge bases.
 * Supports single and multiple selection modes with search filtering.
 * Used in ChatInput to add knowledgebases to message context.
 *
 * @param props.knowledgebases - List of available knowledgebases to select from.
 * @param props.mode - Selection mode: 'single' for exclusive, 'multiple' for multi-select.
 * @param props.selectedIds - Set of currently selected knowledgebase IDs.
 * @param props.onSelect - Callback invoked when selection changes.
 * @param props.className - Optional CSS classes for styling.
 * @param props.maxHeight - Maximum height of the picker container.
 * @param props.showIcons - Whether to show knowledgebase icons.
 * @param props.allowEmpty - Whether to allow deselecting all items (single mode only).
 * @param props.emptyLabel - Label shown when nothing is selected.
 * @author Maruf Bepary
 */
export function KnowledgebasePicker({
  knowledgebases,
  mode = "multiple",
  selectedIds,
  onSelect,
  className,
  maxHeight = "400px",
  showIcons = true,
  allowEmpty = true,
  emptyLabel = "None",
}: KnowledgebasePickerProps) {
  const [search, setSearch] = useState("");

  const filteredKbs = useMemo(
    () =>
      knowledgebases.filter(
        (kb) =>
          kb.name.toLowerCase().includes(search.toLowerCase()) ||
          kb.description?.toLowerCase().includes(search.toLowerCase()),
      ),
    [knowledgebases, search],
  );

  const readyKbs = useMemo(
    () => filteredKbs.filter((kb) => kb.indexStatus === "ready"),
    [filteredKbs],
  );

  const isAllSelected =
    readyKbs.length > 0 && readyKbs.every((kb) => selectedIds.has(kb.id));

  const handleToggle = (id: string) => {
    if (mode === "single") {
      if (selectedIds.has(id)) {
        if (allowEmpty) {
          onSelect(new Set());
        }
      } else {
        onSelect(new Set([id]));
      }
    } else {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelect(next);
    }
  };

  const handleToggleAll = () => {
    if (mode === "single") {
      if (selectedIds.size > 0) {
        onSelect(new Set());
      } else if (readyKbs.length > 0) {
        onSelect(new Set([readyKbs[0].id]));
      }
      return;
    }

    if (isAllSelected) {
      const next = new Set(selectedIds);
      readyKbs.forEach((kb) => {
        next.delete(kb.id);
      });
      onSelect(next);
    } else {
      const next = new Set(selectedIds);
      readyKbs.forEach((kb) => {
        next.add(kb.id);
      });
      onSelect(next);
    }
  };

  const clearSelection = () => {
    onSelect(new Set());
  };

  const selectedCount = useMemo(() => {
    return filteredKbs.filter((kb) => selectedIds.has(kb.id)).length;
  }, [filteredKbs, selectedIds]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search knowledge bases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between px-0.5 text-muted-foreground text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 font-medium text-muted-foreground text-xs hover:text-foreground"
          onClick={handleToggleAll}
          disabled={readyKbs.length === 0}
        >
          {isAllSelected ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <CheckSquare className="h-3.5 w-3.5" />
          )}
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </Button>
        <span>
          {selectedCount > 0
            ? `${selectedCount}/${filteredKbs.length} selected ${filteredKbs.length === 1 ? "knowledge base" : "knowledge bases"}`
            : `${filteredKbs.length} ${filteredKbs.length === 1 ? "knowledge base" : "knowledge bases"} available`}
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="space-y-2">
          {allowEmpty && mode === "single" && (
            <div
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
                selectedIds.size === 0 && "border-primary bg-primary/5",
              )}
              onClick={clearSelection}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-medium text-sm">{emptyLabel}</div>
            </div>
          )}

          {filteredKbs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No knowledge bases found.
            </div>
          ) : (
            filteredKbs.map((kb) => {
              const isReady = kb.indexStatus === "ready";
              const isIndexing = kb.indexStatus === "indexing";

              return (
                <div
                  key={kb.id}
                  className={cn(
                    "group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
                    selectedIds.has(kb.id) && "border-primary bg-primary/5",
                    !isReady && "cursor-not-allowed opacity-60",
                  )}
                  onClick={() => isReady && handleToggle(kb.id)}
                >
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(kb.id)}
                      onCheckedChange={() => isReady && handleToggle(kb.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!isReady}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 gap-3">
                    {showIcons && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium text-sm leading-none">
                          {kb.name}
                        </div>
                        {!isReady && (
                          <Badge
                            variant={isIndexing ? "outline" : "warning"}
                            className={cn(
                              "h-3.5 px-1 text-[7px] uppercase",
                              isIndexing && "border-blue-200 text-blue-500",
                            )}
                          >
                            {isIndexing ? (
                              <Loader2 className="mr-0.5 h-2 w-2 animate-spin" />
                            ) : (
                              <AlertTriangle className="mr-0.5 h-2 w-2" />
                            )}
                            {kb.indexStatus}
                          </Badge>
                        )}
                      </div>
                      {kb.description && (
                        <p className="line-clamp-1 text-muted-foreground text-xs">
                          {kb.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface KnowledgebasePickerDialogProps {
  knowledgebases: Knowledgebase[];
  selectedKbs: Set<string>;
  onToggleKb: (id: string) => void;
  onSelectKbs?: (ids: Set<string>) => void;
  trigger?: React.ReactNode;
}

/**
 * Dialog wrapper for the KnowledgebasePicker.
 */
export function KnowledgebasePickerDialog({
  knowledgebases,
  selectedKbs,
  onToggleKb,
  onSelectKbs,
  trigger,
}: KnowledgebasePickerDialogProps) {
  return (
    <PickerDialog
      title="Select Knowledge Bases"
      description="Choose knowledge bases to reference in your conversation"
      trigger={
        trigger || (
          <Button>
            <Database className="mr-2 h-4 w-4" />
            Select Knowledge Bases
          </Button>
        )
      }
      isEmpty={knowledgebases.length === 0}
      emptyIcon={Database}
      emptyTitle="No knowledge bases available."
      emptyAction={{
        label: "Create a knowledge base",
        href: ROUTES.KNOWLEDGEBASES.path,
      }}
      manageAction={{
        label: "Manage Knowledge Bases",
        href: ROUTES.KNOWLEDGEBASES.path,
      }}
    >
      <KnowledgebasePicker
        knowledgebases={knowledgebases}
        selectedIds={selectedKbs}
        onSelect={(ids) => {
          if (onSelectKbs) {
            onSelectKbs(ids);
            return;
          }
          const added = [...ids].filter((id) => !selectedKbs.has(id));
          const removed = [...selectedKbs].filter((id) => !ids.has(id));
          added.forEach((id) => {
            onToggleKb(id);
          });
          removed.forEach((id) => {
            onToggleKb(id);
          });
        }}
        className="flex min-h-0 flex-1 flex-col p-4"
        showIcons={false}
      />
    </PickerDialog>
  );
}
