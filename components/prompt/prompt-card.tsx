"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deletePrompt } from "@/actions/prompts/delete-prompt";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Props for the PromptCard component.
 *
 */
interface PromptCardProps {
  /** The prompt entity containing id, title, shortcut, and content for display. */
  prompt: Prompt;
}

/**
 * Card displaying prompt title, content preview, and footer with shortcut badge and action buttons.
 * The top section uses Next.js Link for navigation; the bottom section houses metadata badges and actions.
 *
 * @param props.prompt - Prompt entity with title, shortcut, and content metadata.
 */
export function PromptCard({ prompt }: PromptCardProps) {
  const loadPrompts = useAppStore((state) => state.loadPrompts);
  const projects = useAppStore((state) => state.projects);
  const assistants = useAppStore((state) => state.assistants);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const detailUrl = ROUTES.SETTINGS.PROMPTS.detail(prompt.id);

  const projectCount = prompt.projectIds?.length ?? 0;
  const assistantCount = prompt.assistantIds?.length ?? 0;

  let scopeLabel = "Global";
  if (projectCount > 0 && assistantCount > 0) {
    scopeLabel = `${projectCount} Proj, ${assistantCount} Asst`;
  } else if (projectCount === 1) {
    scopeLabel = `Project: ${projects.find((p) => p.id === prompt.projectIds[0])?.name || "Project"}`;
  } else if (projectCount > 1) {
    scopeLabel = `${projectCount} Projects`;
  } else if (assistantCount === 1) {
    scopeLabel = `Assistant: ${assistants.find((a) => a.id === prompt.assistantIds[0])?.name || "Assistant"}`;
  } else if (assistantCount > 1) {
    scopeLabel = `${assistantCount} Assistants`;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePrompt(prompt.id);
      await loadPrompts();
      toast.success("Prompt deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete prompt");
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
            {prompt.title}
          </h3>
        </div>
        {prompt.content && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {prompt.content}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="bg-muted py-0 font-mono text-[10px]"
          >
            {prompt.shortcut.startsWith("/")
              ? prompt.shortcut
              : `/${prompt.shortcut}`}
          </Badge>
          <Badge variant="outline" className="py-0 text-[10px]">
            {scopeLabel}
          </Badge>
        </div>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
              >
                <Link href={detailUrl} aria-label="Open prompt">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open prompt</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete prompt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete prompt</TooltipContent>
          </Tooltip>

          <DeleteConfirmDialog
            isOpen={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            onConfirm={handleDelete}
            title="Delete Prompt"
            description={`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`}
            loading={isDeleting}
          />
        </div>
      </div>
    </Card>
  );
}
