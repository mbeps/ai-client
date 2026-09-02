"use client";

import { Files, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ROUTES } from "@/constants/routes";
import { deleteSkill } from "@/lib/actions/skills/delete-skill";
import { toggleSkillEnabled } from "@/lib/actions/skills/toggle-skill";
import { useAppStore } from "@/lib/store";
import type { Skill } from "@/types/skill/skill";

interface SkillCardProps {
  skill: Skill;
}

/**
 * Card displaying Agent Skill summary, toggle switch, and delete action.
 *
 * @author Maruf Bepary
 */
export function SkillCard({ skill }: SkillCardProps) {
  const router = useRouter();
  const loadSkills = useAppStore((state) => state.loadSkills);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await toggleSkillEnabled(skill.id, checked);
      await loadSkills();
      toast.success(checked ? "Skill enabled" : "Skill disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to update skill");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSkill(skill.id);
      await loadSkills();
      toast.success("Skill deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete skill");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      className="group flex min-h-[120px] cursor-pointer flex-col justify-between p-4 transition-colors hover:bg-muted/50"
      onClick={() => router.push(ROUTES.SETTINGS.SKILLS.detail(skill.id))}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold leading-none">
                {skill.displayName || skill.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="bg-muted py-0 font-mono text-[10px]"
              >
                /{skill.name}
              </Badge>
              {skill.files && skill.files.length > 0 && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 py-0 text-[10px]"
                >
                  <Files className="h-3 w-3" />
                  {skill.files.length}{" "}
                  {skill.files.length === 1 ? "file" : "files"}
                </Badge>
              )}
            </div>
            {skill.description && (
              <p className="line-clamp-2 text-muted-foreground text-xs">
                {skill.description}
              </p>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={skill.enabled}
            onCheckedChange={handleToggle}
            disabled={isToggling}
            aria-label="Toggle skill"
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;
                  {skill.displayName || skill.name}&quot;? This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
