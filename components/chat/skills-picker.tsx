"use client";

import { BrainCircuit, Check, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skill/skill";

interface SkillsPickerProps {
  skills: Skill[];
  selectedIds: Set<string>;
  onToggleSkill: (id: string) => void;
  className?: string;
  maxHeight?: string;
}

/**
 * Picker list for selecting Agent Skills.
 *
 * @author Maruf Bepary
 */
export function SkillsPicker({
  skills,
  selectedIds,
  onToggleSkill,
  className,
  maxHeight = "350px",
}: SkillsPickerProps) {
  const [search, setSearch] = useState("");

  const filteredSkills = skills.filter(
    (s) =>
      s.enabled &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="pr-4" style={{ maxHeight }}>
        <div className="space-y-2">
          {filteredSkills.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No skills found.
            </div>
          ) : (
            filteredSkills.map((s) => {
              const isSelected =
                selectedIds.has(s.id) || selectedIds.has(s.name);

              return (
                <div
                  key={s.id}
                  className={cn(
                    "group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
                    isSelected && "border-primary bg-primary/5",
                  )}
                  onClick={() => onToggleSkill(s.id)}
                >
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSkill(s.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate font-medium text-sm leading-none">
                          {s.displayName || s.name}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="h-4 shrink-0 bg-muted px-1 py-0 text-[10px] text-muted-foreground"
                      >
                        /{s.name}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="line-clamp-2 text-muted-foreground text-xs">
                        {s.description}
                      </p>
                    )}
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

interface SkillsPickerDialogProps {
  skills: Skill[];
  selectedSkills: Set<string>;
  onToggleSkill: (id: string) => void;
  trigger?: React.ReactNode;
}

/**
 * Dialog wrapper for SkillsPicker.
 *
 * @author Maruf Bepary
 */
export function SkillsPickerDialog({
  skills,
  selectedSkills,
  onToggleSkill,
  trigger,
}: SkillsPickerDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <BrainCircuit className="mr-2 h-4 w-4" />
            Select Skills
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-w-md flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-4 pt-4 pb-3">
          <DialogTitle>Select Agent Skills</DialogTitle>
        </DialogHeader>

        {skills.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
            <p className="mb-2">No skills configured yet.</p>
            <Link
              href={ROUTES.SETTINGS.SKILLS.path}
              className="text-primary underline underline-offset-4"
              onClick={() => setOpen(false)}
            >
              Create or upload a skill in Settings
            </Link>
          </div>
        ) : (
          <>
            <SkillsPicker
              skills={skills}
              selectedIds={selectedSkills}
              onToggleSkill={onToggleSkill}
              className="p-4"
              maxHeight="320px"
            />

            <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-3">
              <p className="text-muted-foreground text-xs">
                <strong>{selectedSkills.size}</strong>{" "}
                {selectedSkills.size === 1 ? "skill" : "skills"} selected
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
