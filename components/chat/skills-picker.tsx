"use client";

import {
  BrainCircuit,
  Check,
  CheckSquare,
  ExternalLink,
  Search,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skill/skill";

interface SkillsPickerProps {
  skills: Skill[];
  selectedIds: Set<string>;
  onToggleSkill: (id: string) => void;
  onSelectSkills?: (skills: Set<string>) => void;
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
  onSelectSkills,
  className,
  maxHeight = "350px",
}: SkillsPickerProps) {
  const [search, setSearch] = useState("");

  const enabledSkills = useMemo(
    () => skills.filter((s) => s.enabled),
    [skills],
  );

  const filteredSkills = useMemo(
    () =>
      enabledSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.displayName.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [enabledSkills, search],
  );

  const isAllSelected =
    filteredSkills.length > 0 &&
    filteredSkills.every(
      (s) => selectedIds.has(s.id) || selectedIds.has(s.name),
    );

  const handleToggleAll = () => {
    if (onSelectSkills) {
      if (isAllSelected) {
        const next = new Set(selectedIds);
        filteredSkills.forEach((s) => {
          next.delete(s.id);
          next.delete(s.name);
        });
        onSelectSkills(next);
      } else {
        const next = new Set(selectedIds);
        filteredSkills.forEach((s) => {
          next.add(s.id);
        });
        onSelectSkills(next);
      }
    } else {
      if (isAllSelected) {
        filteredSkills.forEach((s) => {
          if (selectedIds.has(s.id) || selectedIds.has(s.name)) {
            onToggleSkill(s.id);
          }
        });
      } else {
        filteredSkills.forEach((s) => {
          if (!selectedIds.has(s.id) && !selectedIds.has(s.name)) {
            onToggleSkill(s.id);
          }
        });
      }
    }
  };

  const selectedCount = useMemo(() => {
    return filteredSkills.filter(
      (s) => selectedIds.has(s.id) || selectedIds.has(s.name),
    ).length;
  }, [filteredSkills, selectedIds]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
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
          disabled={filteredSkills.length === 0}
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
            ? `${selectedCount}/${filteredSkills.length} selected ${filteredSkills.length === 1 ? "skill" : "skills"}`
            : `${filteredSkills.length} ${filteredSkills.length === 1 ? "skill" : "skills"} available`}
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        style={maxHeight ? { maxHeight } : undefined}
      >
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
                      <span className="truncate font-medium text-sm leading-none">
                        {s.displayName || s.name}
                      </span>
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
      </div>
    </div>
  );
}

interface SkillsPickerDialogProps {
  skills: Skill[];
  selectedSkills: Set<string>;
  onToggleSkill: (id: string) => void;
  onSelectSkills?: (skills: Set<string>) => void;
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
  onSelectSkills,
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
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden p-0 sm:max-h-[600px] sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3.5 pr-12">
          <DialogTitle className="font-semibold text-base">
            Select Agent Skills
          </DialogTitle>
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
              onSelectSkills={onSelectSkills}
              className="flex min-h-0 flex-1 flex-col p-4"
            />

            <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
              >
                <Link
                  href={ROUTES.SETTINGS.SKILLS.path}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Manage Skills</span>
                </Link>
              </Button>
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
