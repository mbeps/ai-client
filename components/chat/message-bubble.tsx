"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Message } from "@/lib/store";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  User,
} from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

/**
 * Props for the MessageBubble component.
 *
 * @author Maruf Bepary
 */
interface MessageBubbleProps {
  /** The message node from the conversation tree to render. */
  message: Message;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Callback to delete this message from the conversation tree. */
  onDelete: (id: string) => void;
  /** Callback to edit this message, which creates a new branch. */
  onEdit: (id: string, newContent: string) => void;
  // Branching props
  /** All sibling messages sharing the same parent; enables branch navigation. */
  siblings: Message[];
  /** Zero-based index of this message among its siblings. */
  currentSiblingIndex: number;
  /** Callback invoked with a sibling's ID when the user clicks a branch arrow. */
  onNavigateBranch: (siblingId: string) => void;
}

/**
 * Renders a single message within the conversation thread.
 * User messages are displayed as plain pre-wrapped text; assistant messages are
 * rendered via `MarkdownRenderer`. When a message has siblings (i.e. the parent
 * has multiple children due to edits), left/right navigation arrows are shown on
 * hover. Edit and delete actions are also revealed on hover.
 *
 * @param props.message - The message node to render.
 * @param props.onDelete - Invoked with the message ID when Delete is clicked.
 * @param props.onEdit - Invoked with the message ID and new content on edit.
 * @param props.siblings - Sibling messages for branch navigation arrows.
 * @param props.currentSiblingIndex - Position of this message among its siblings.
 * @param props.onNavigateBranch - Invoked with the target sibling ID on navigation.
 * @author Maruf Bepary
 */
export function MessageBubble({
  message,
  onDelete,
  onEdit,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-4 p-4 w-full group ${isUser ? "" : "bg-muted/30"}`}
    >
      <div className="shrink-0 mt-1">
        <Avatar className="h-8 w-8">
          {isUser ? (
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </AvatarFallback>
          ) : (
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          )}
        </Avatar>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="font-semibold text-sm mb-1">
          {isUser ? "You" : "Assistant"}
        </div>

        <div className="text-sm">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

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

          {isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
