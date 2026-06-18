"use client";

import { Trash2, Edit2, MessageSquare, Settings2 } from "lucide-react";
import type { Assistant } from "@/types/assistant/assistant";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { renameAssistant } from "@/lib/actions/assistants/rename-assistant";
import { deleteAssistant } from "@/lib/actions/assistants/delete-assistant";
import { useAppStore } from "@/lib/store";

/**
 * Dropdown/Drawer menu with New Chat, Manage, Rename, and Delete options for assistants.
 * Uses useEntityOptions hook to manage dialog state and handles mutations via direct Server Actions.
 * Responsive design: renders as Popover on desktop, Drawer on mobile via useIsMobile.
 *
 * @param props.assistant - Assistant entity with id and name.
 * @returns Menu with action items, rename dialog, and delete confirmation dialog.
 * @see useEntityOptions for shared dialog and action state management.
 * @see ResponsiveMenu for desktop/mobile responsive menu wrapper.
 */
export function AssistantOptions({ assistant }: { assistant: Assistant }) {
  const router = useRouter();
  const createNewChat = useCreateChat();
  const loadAssistants = useAppStore((state) => state.loadAssistants);

  const {
    isMobile,
    showRename,
    setShowRename,
    showDelete,
    setShowDelete,
    isDeleting,
    handleRename,
    handleDelete,
  } = useEntityOptions({
    id: assistant.id,
    type: "Assistant",
    onRename: (id, name) => renameAssistant(id, name),
    onDelete: (id) => deleteAssistant(id),
    redirectPath: ROUTES.ASSISTANTS.path,
    useRouterRefresh: true,
    onAfterMutation: loadAssistants,
  });

  const items = [
    {
      label: "New Chat",
      icon: <MessageSquare className="mr-2 h-4 w-4" />,
      onClick: () => createNewChat("New Chat", undefined, assistant.id),
    },
    {
      label: "Manage",
      icon: <Settings2 className="mr-2 h-4 w-4" />,
      onClick: () => router.push(ROUTES.ASSISTANTS.detail(assistant.id)),
      separator: true,
    },
    {
      label: "Rename Assistant",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Assistant",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <BaseEntityOptions
      name={assistant.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Assistant"
      deleteTitle="Delete Assistant"
    />
  );
}
