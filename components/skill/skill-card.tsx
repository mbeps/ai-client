"use client";

import { ExternalLink, Files, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSkill } from "@/actions/skills/delete-skill";
import { toggleSkillEnabled } from "@/actions/skills/toggle-skill";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Skill } from "@/types/skill/skill";

/**
 * Represents skill card props.
 *
 * @author Maruf Bepary
 */
interface SkillCardProps {
  skill: Skill;
}

/**
 * Card displaying Agent Skill summary, toggle switch, and delete action.
 * The top section uses Next.js Link for navigation; the bottom section houses metadata badges and actions.
 *
 * @author Maruf Bepary
 */
export function SkillCard({ skill }: SkillCardProps) {
  const loadSkills = useAppStore((state) => state.loadSkills);
  const projects = useAppStore((state) => state.projects);
  const assistants = useAppStore((state) => state.assistants);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const detailUrl = ROUTES.SETTINGS.SKILLS.detail(skill.id);

  const projectCount = skill.projectIds?.length ?? 0;
  const assistantCount = skill.assistantIds?.length ?? 0;

  let scopeLabel = "Global";
  if (projectCount > 0 && assistantCount > 0) {
    scopeLabel = `${projectCount} Proj, ${assistantCount} Asst`;
  } else if (projectCount === 1) {
    scopeLabel = `Project: ${projects.find((p) => p.id === skill.projectIds[0])?.name || "Project"}`;
  } else if (projectCount > 1) {
    scopeLabel = `${projectCount} Projects`;
  } else if (assistantCount === 1) {
    scopeLabel = `Assistant: ${assistants.find((a) => a.id === skill.assistantIds[0])?.name || "Assistant"}`;
  } else if (assistantCount > 1) {
    scopeLabel = `${assistantCount} Assistants`;
  }

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      const res = await toggleSkillEnabled(skill.id, checked);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to update skill");
        return;
      }
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
      const res = await deleteSkill(skill.id);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to delete skill");
        return;
      }
      await loadSkills();
      toast.success("Skill deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete skill");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:bg-muted/30 flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors">
      <Link
        href={detailUrl}
        className="group block flex-1 space-y-1.5 focus-visible:outline-none"
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-foreground group-hover:text-primary truncate text-sm leading-none font-semibold transition-colors">
            {skill.displayName || skill.name}
          </h3>
        </div>
        {skill.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {skill.description}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="bg-muted py-0 font-mono text-[10px]"
          >
            /{skill.name}
          </Badge>
          <Badge variant="outline" className="py-0 text-[10px]">
            {scopeLabel}
          </Badge>
          {skill.files && skill.files.length > 0 && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 py-0 text-[10px]"
            >
              <Files className="h-3 w-3" />
              {skill.files.length} {skill.files.length === 1 ? "file" : "files"}
            </Badge>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={handleToggle}
                  disabled={isToggling}
                  aria-label="Toggle skill"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {skill.enabled ? "Disable skill" : "Enable skill"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
              >
                <Link href={detailUrl} aria-label="Open skill">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open skill</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete skill"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete skill</TooltipContent>
          </Tooltip>

          <DeleteConfirmDialog
            isOpen={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            onConfirm={handleDelete}
            title="Delete Skill"
            description={`Are you sure you want to delete "${
              skill.displayName || skill.name
            }"? This action cannot be undone.`}
            loading={isDeleting}
          />
        </div>
      </div>
    </Card>
  );
}
