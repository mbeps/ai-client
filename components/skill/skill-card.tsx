"use client";

import { Card } from "@/components/ui/card";
import { BrainCircuit, Trash2, Files } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import type { Skill } from "@/types/skill/skill";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toggleSkillEnabled } from "@/lib/actions/skills/toggle-skill";
import { deleteSkill } from "@/lib/actions/skills/delete-skill";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";
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
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[120px]"
      onClick={() => router.push(ROUTES.SETTINGS.SKILLS.detail(skill.id))}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold leading-none truncate">
                {skill.displayName || skill.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="font-mono text-[10px] py-0 bg-muted"
              >
                /{skill.name}
              </Badge>
              {skill.files && skill.files.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 flex items-center gap-1"
                >
                  <Files className="h-3 w-3" />
                  {skill.files.length}{" "}
                  {skill.files.length === 1 ? "file" : "files"}
                </Badge>
              )}
            </div>
            {skill.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
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
