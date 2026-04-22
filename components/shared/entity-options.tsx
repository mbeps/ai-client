"use client";

import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ChatOptions } from "@/components/chat/chat-options";
import { ProjectOptions } from "@/components/project/project-options";
import { AssistantOptions } from "@/components/assistant/assistant-options";
import { KnowledgebaseOptions } from "@/components/knowledgebase/knowledgebase-options";

/**
 * Global component rendered in the main header that contextually provides
 * management options (rename, delete, etc.) based on the current URL.
 * It identifies the active entity by matching URL segments against the Zustand store.
 *
 * @returns An options dropdown for the current entity, or null if no entity matches.
 * @author Maruf Bepary
 */
export function EntityOptions() {
  const pathname = usePathname();
  const { chats, projects, assistants, knowledgebases } = useAppStore();
  
  const segments = pathname.split("/").filter(Boolean);
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
    const kb = knowledgebases.find((kb) => kb.id === segment);
    if (kb) return <KnowledgebaseOptions kb={kb} />;
  }

  return null;
}
