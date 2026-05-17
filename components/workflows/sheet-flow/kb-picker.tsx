"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Knowledgebase } from "@/types/knowledgebase";
import { Database, Search } from "lucide-react";
import { useState } from "react";

interface KBPickerProps {
  knowledgebases: Knowledgebase[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function KBPicker({
  knowledgebases,
  selectedIds,
  onToggle,
}: KBPickerProps) {
  const [search, setSearch] = useState("");

  const filteredKbs = knowledgebases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(search.toLowerCase()) ||
      kb.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge bases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {filteredKbs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No knowledge bases found.
            </div>
          ) : (
            filteredKbs.map((kb) => (
              <div
                key={kb.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => onToggle(kb.id)}
              >
                <div className="pt-0.5">
                  <Checkbox
                    checked={selectedIds.has(kb.id)}
                    onCheckedChange={() => onToggle(kb.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1 min-w-0 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="font-medium leading-none truncate pr-4">
                      {kb.name}
                    </div>
                    {kb.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {kb.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
