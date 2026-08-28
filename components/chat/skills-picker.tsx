"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Skill } from "@/types/skill/skill";
import { BrainCircuit, Search, Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <div className="text-center py-8 text-muted-foreground text-sm">
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
                    "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group",
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
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm leading-none truncate">
                          {s.displayName || s.name}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1 py-0 h-4 bg-muted text-muted-foreground shrink-0"
                      >
                        /{s.name}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
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
        {trigger || <Button>Select Skills</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle>Select Agent Skills</DialogTitle>
        </DialogHeader>

        {skills.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <BrainCircuit className="h-8 w-8 mx-auto mb-3 text-primary opacity-40" />
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

            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/20 shrink-0">
              <p className="text-xs text-muted-foreground">
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
