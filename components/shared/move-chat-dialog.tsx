"use client";

import { useAppStore } from "@/lib/store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Folder, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface MoveChatDialogProps {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Callback fired when the dialog should close. */
  onClose: () => void;
  /** The ID of the chat to be moved. */
  chatId: string;
  /** The current project ID of the chat, if any. */
  currentProjectId?: string;
}

/**
 * A search-enabled dialog that allows users to move a chat to a project.
 * Uses Shadcn UI's Command component for quick filtering.
 *
 * @author Maruf Bepary
 */
export function MoveChatDialog({
  isOpen,
  onClose,
  chatId,
  currentProjectId,
}: MoveChatDialogProps) {
  const projects = useAppStore((state) => state.projects);
  const moveChatDb = useAppStore((state) => state.moveChatDb);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (projectId: string | null) => {
    if (projectId === (currentProjectId ?? null)) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      await moveChatDb(chatId, projectId);
      toast.success(
        projectId ? "Chat moved to project" : "Chat moved to no project",
      );
      onClose();
    } catch (error) {
      toast.error("Failed to move chat");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Move Chat"
      description="Select a project to move this chat to."
    >
      <CommandInput placeholder="Search projects..." disabled={isLoading} />
      <CommandList>
        <CommandEmpty>No projects found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => handleSelect(null)}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <Inbox className="mr-2 h-4 w-4" />
            <span>No Project</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Projects">
          {projects.map((project) => (
            <CommandItem
              key={project.id}
              onSelect={() => handleSelect(project.id)}
              disabled={isLoading}
              className="cursor-pointer"
            >
              <Folder className="mr-2 h-4 w-4" />
              <span>{project.name}</span>
              {project.id === currentProjectId && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Current
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
