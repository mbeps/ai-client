"use client";

import { format } from "date-fns";
import { Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { listWorkflowChats } from "@/actions/workflows/get-or-create-workflow-chat";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useApiError } from "@/hooks/use-api-error";
import type { ChatRow } from "@/types/chat/chat-row";

/** Props for {@link WorkflowChatHistoryDialog}. */
interface WorkflowChatHistoryDialogProps {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Callback fired when the dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Workflow ID whose builder chat history should be displayed. */
  workflowId: string;
  /** Currently active chat ID in the builder panel. */
  activeChatId: string | null;
  /** Callback fired when the user selects a chat from history. */
  onSelectChat: (chatId: string) => void;
}

/**
 * Searchable Command dialog displaying past AI Workflow Builder chats for a workflow.
 * Uses Shadcn UI's Command component for instant client-side filtering.
 */
export function WorkflowChatHistoryDialog({
  isOpen,
  onOpenChange,
  workflowId,
  activeChatId,
  onSelectChat,
}: WorkflowChatHistoryDialogProps) {
  const { handleApiError } = useApiError();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    listWorkflowChats(workflowId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          handleApiError(res.error, "Failed to load workflow chat history");
          return;
        }
        setChats(res.value);
      })
      .catch((err) => {
        if (!cancelled) {
          handleApiError(err, "Failed to load workflow chat history");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, workflowId, handleApiError]);

  const handleSelect = (selectedChatId: string) => {
    onSelectChat(selectedChatId);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title="Workflow Chat History"
      description="Search and switch between previous AI Workflow Builder chats."
    >
      <CommandInput placeholder="Search workflow chats..." />
      <CommandList>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history...
          </div>
        ) : (
          <>
            <CommandEmpty>No workflow chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((item) => {
                const updatedDate = item.updatedAt
                  ? new Date(item.updatedAt)
                  : null;
                const formattedDate =
                  updatedDate && !Number.isNaN(updatedDate.getTime())
                    ? format(updatedDate, "MMM d, HH:mm")
                    : null;

                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${formattedDate ?? ""} ${item.id}`}
                    onSelect={() => handleSelect(item.id)}
                    className="cursor-pointer"
                  >
                    <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                    <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs">
                      {item.id === activeChatId && (
                        <span className="text-primary font-medium">
                          Current
                        </span>
                      )}
                      {formattedDate && <span>{formattedDate}</span>}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
