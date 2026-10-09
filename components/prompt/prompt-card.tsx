"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deletePrompt } from "@/actions/prompts/delete-prompt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const detailUrl = ROUTES.SETTINGS.PROMPTS.detail(prompt.id);

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
    <Card className="flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors hover:bg-muted/30">
      <Link
        href={detailUrl}
        className="group block flex-1 space-y-1.5 focus-visible:outline-none"
      >
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-semibold text-foreground text-sm leading-none transition-colors group-hover:text-primary">
            {prompt.title}
          </h3>
        </div>
        {prompt.content && (
          <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
            {prompt.content}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge
            variant="secondary"
            className="bg-muted py-0 font-mono text-[10px]"
          >
            {prompt.shortcut.startsWith("/")
              ? prompt.shortcut
              : `/${prompt.shortcut}`}
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
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete prompt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete prompt</TooltipContent>
          </Tooltip>

          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{prompt.title}&quot;?
                  This action cannot be undone.
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
