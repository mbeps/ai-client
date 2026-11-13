"use client";

import { Edit2, Eye, MessageSquare, Settings2, Trash2 } from "lucide-react";
import { deleteAgent } from "@/actions/agents/delete-agent";
import { renameAgent } from "@/actions/agents/rename-agent";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { ROUTES } from "@/config/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Agent } from "@/types/agent/agent";

/**
 * Dropdown/Drawer menu with New Chat, Manage/Inspect, Rename, and Delete options for agents.
 * Built-in agents are read-only and omit Rename/Delete actions; `builtin:kb-reader` omits New Chat.
 *
 * @param props.agent - Unified Agent entity.
 */
export function AgentOptions({ agent }: { agent: Agent }) {
  const createNewChat = useCreateChat();
  const loadAgents = useAppStore((state) => state.loadAgents);
  const deleteAgentFromStore = useAppStore((state) => state.deleteAgent);

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
    id: agent.id,
    type: "Agent",
    onRename: (id, name) => renameAgent(id, name),
    onDelete: async (id) => {
      const res = await deleteAgent(id);
      if (res.ok) {
        deleteAgentFromStore(id);
      }
      return res;
    },
    redirectPath: ROUTES.AGENTS.path,
    useRouterRefresh: true,
    onAfterMutation: loadAgents,
  });

  const canChat = agent.id !== "builtin:kb-reader";

  const items = [
    ...(canChat
      ? [
          {
            label: "New Chat",
            icon: <MessageSquare className="mr-2 h-4 w-4" />,
            onClick: () => createNewChat("New Chat", undefined, agent.id),
          },
        ]
      : []),
    {
      label: agent.isBuiltIn ? "Inspect" : "Manage",
      icon: agent.isBuiltIn ? (
        <Eye className="mr-2 h-4 w-4" />
      ) : (
        <Settings2 className="mr-2 h-4 w-4" />
      ),
      href: ROUTES.AGENTS.detail(agent.id),
      separator: canChat,
    },
    ...(!agent.isBuiltIn
      ? [
          {
            label: "Rename Agent",
            icon: <Edit2 className="mr-2 h-4 w-4" />,
            onClick: () => setShowRename(true),
          },
          {
            label: "Delete Agent",
            icon: <Trash2 className="mr-2 h-4 w-4" />,
            onClick: () => setShowDelete(true),
            isDestructive: true,
          },
        ]
      : []),
  ];

  return (
    <BaseEntityOptions
      name={agent.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename"
      deleteTitle="Delete"
    />
  );
}
