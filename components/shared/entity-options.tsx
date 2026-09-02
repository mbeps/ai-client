"use client";

import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { AssistantOptions } from "@/components/assistant/assistant-options";
import { ChatOptions } from "@/components/chat/chat-options";
import { KnowledgebaseOptions } from "@/components/knowledgebase/knowledgebase-options";
import { ProjectOptions } from "@/components/project/project-options";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useAppStore } from "@/lib/store";
import { getPathSegments } from "@/lib/utils";

/**
 * Global component rendered in the main header that contextually provides
 * management options (rename, delete, etc.) based on the current URL.
 * It identifies the active entity by matching URL segments against the Zustand store.
 *
 * @returns An options dropdown for the current entity, or null if no entity matches.
 */
export function EntityOptions() {
  const pathname = usePathname();
  const { chats, projects, assistants } = useAppStore(
    useShallow((s) => ({
      chats: s.chats,
      projects: s.projects,
      assistants: s.assistants,
    })),
  );
  const { normalizedKnowledgebases } = useKnowledgebases();

  const segments = getPathSegments(pathname);
  if (segments.length === 0) return null;

  // Walk backward through URL segments to find the most specific entity ID
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];

    // Check if the segment is a Chat ID
    const chat = chats[segment];
    if (chat) return <ChatOptions chat={chat} />;

    // Check if the segment is a Project ID
    const project = projects.find((p) => p.id === segment);
    if (project) return <ProjectOptions project={project} />;

    // Check if the segment is an Assistant ID
    const assistant = assistants.find((a) => a.id === segment);
    if (assistant) return <AssistantOptions assistant={assistant} />;

    // Check if the segment is a Knowledgebase ID
    const kb = normalizedKnowledgebases.find((kb) => kb.id === segment);
    if (kb) return <KnowledgebaseOptions kb={kb} />;
  }

  return null;
}
