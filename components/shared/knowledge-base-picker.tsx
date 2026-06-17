"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import {
  Database,
  Search,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface KnowledgeBasePickerProps {
  knowledgebases: Knowledgebase[];

  // Selection mode
  mode?: "single" | "multiple";

  // Selection state
  selectedIds: Set<string>;

  // Callbacks
  onSelect: (ids: Set<string>) => void;

  // UI Customisation
  className?: string;
  maxHeight?: string;
  showIcons?: boolean;

  // Empty state handling
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function KnowledgeBasePicker({
  knowledgebases,
  mode = "multiple",
  selectedIds,
  onSelect,
  className,
  maxHeight = "400px",
  showIcons = true,
  allowEmpty = true,
  emptyLabel = "None",
}: KnowledgeBasePickerProps) {
  const [search, setSearch] = useState("");

  const filteredKbs = knowledgebases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(search.toLowerCase()) ||
      kb.description?.toLowerCase().includes(search.toLowerCase()),
  );

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

  const clearSelection = () => {
    onSelect(new Set());
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge bases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="pr-4" style={{ maxHeight }}>
        <div className="space-y-2">
          {allowEmpty && mode === "single" && (
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group",
                selectedIds.size === 0 && "border-primary bg-primary/5",
              )}
              onClick={clearSelection}
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-medium text-sm">{emptyLabel}</div>
            </div>
          )}

          {filteredKbs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
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
                    "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group",
                    selectedIds.has(kb.id) && "border-primary bg-primary/5",
                    !isReady && "opacity-60 cursor-not-allowed",
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
                  <div className="flex-1 min-w-0 flex gap-3">
                    {showIcons && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm leading-none truncate">
                          {kb.name}
                        </div>
                        {!isReady && (
                          <Badge
                            variant={isIndexing ? "outline" : "warning"}
                            className={cn(
                              "h-3.5 px-1 text-[7px] uppercase",
                              isIndexing && "text-blue-500 border-blue-200",
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
                        <p className="text-xs text-muted-foreground line-clamp-1">
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
      </ScrollArea>
    </div>
  );
}
