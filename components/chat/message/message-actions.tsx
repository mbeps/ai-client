"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Message } from "@/types/message";

interface MessageActionsProps {
  message: Message;
  isUser: boolean;
  contentToCopy: string;
  onEdit?: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onRegenerate?: (id: string) => void;
  // Branching props
  siblings: Message[];
  currentSiblingIndex: number;
  onNavigateBranch: (siblingId: string) => void;
  editContent?: string;
  modelName?: string | null;
}

export function MessageActions({
  message,
  isUser,
  contentToCopy,
  onEdit,
  onDelete,
  onRegenerate,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
  editContent,
  modelName,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy text");
    }
  };

  return (
    <div className="flex items-center mt-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Branching Navigation */}
      {siblings.length > 1 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={currentSiblingIndex === 0}
            onClick={() =>
              onNavigateBranch(siblings[currentSiblingIndex - 1].id)
            }
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span>
            {currentSiblingIndex + 1} / {siblings.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={currentSiblingIndex === siblings.length - 1}
            onClick={() =>
              onNavigateBranch(siblings[currentSiblingIndex + 1].id)
            }
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy markdown</TooltipContent>
      </Tooltip>

      {isUser && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit?.(message.id, editContent ?? message.content)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit message</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete message</TooltipContent>
      </Tooltip>

      {!isUser && onRegenerate && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onRegenerate(message.id)}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Regenerate response</TooltipContent>
        </Tooltip>
      )}

      {!isUser && modelName && (
        <div className="ml-auto text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
          {modelName}
        </div>
      )}
    </div>
  );
}
