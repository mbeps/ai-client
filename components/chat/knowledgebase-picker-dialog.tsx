"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Database, X } from "lucide-react";
import Link from "next/link";
import type { Knowledgebase } from "@/types/knowledgebase";
import { ROUTES } from "@/constants/routes";

interface KnowledgebasePickerDialogProps {
  knowledgebases: Knowledgebase[];
  selectedKbs: Set<string>;
  onToggleKb: (id: string) => void;
  trigger?: React.ReactNode;
}

export function KnowledgebasePickerDialog({
  knowledgebases,
  selectedKbs,
  onToggleKb,
  trigger,
}: KnowledgebasePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = knowledgebases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(search.toLowerCase()) ||
      (kb.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Select Knowledge Bases</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle>Select Knowledge Bases</DialogTitle>
        </DialogHeader>

        {knowledgebases.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="mb-2">No knowledge bases available.</p>
            <Link
              href={ROUTES.KNOWLEDGEBASES.path}
              className="text-primary underline underline-offset-4"
              onClick={() => setOpen(false)}
            >
              Create a knowledge base
            </Link>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b">
              <Input
                placeholder="Search knowledge bases…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <ScrollArea className="flex-1 max-h-72">
              <div className="p-2 space-y-0.5">
                {filtered.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No results for &quot;{search}&quot;
                  </p>
                ) : (
                  filtered.map((kb) => {
                    const isSelected = selectedKbs.has(kb.id);
                    return (
                      <button
                        key={kb.id}
                        type="button"
                        className="flex items-start gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                        onClick={() => onToggleKb(kb.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="mt-0.5 shrink-0"
                          onCheckedChange={() => onToggleKb(kb.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight truncate">
                            {kb.name}
                          </p>
                          {kb.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {kb.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {kb.documentCount}{" "}
                            {kb.documentCount === 1 ? "document" : "documents"}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/20 shrink-0">
              <p className="text-xs text-muted-foreground">
                <strong>{selectedKbs.size}</strong>{" "}
                {selectedKbs.size === 1 ? "knowledge base" : "knowledge bases"}{" "}
                selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="gap-2 px-6"
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
