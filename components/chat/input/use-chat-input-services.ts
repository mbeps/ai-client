import { useChatModelSelection } from "@/components/chat/input/use-chat-model-selection";
import { useApiError } from "@/hooks/use-api-error";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Aggregates platform services, models, stores, and responsiveness queries for ChatInput.
 */
export function useChatInputServices(initialModelId?: string) {
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");

  const model = useChatModelSelection(
    chatModels,
    isModelsLoading,
    initialModelId,
  );

  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();
  const skills = useAppStore((state) => state.skills);
  const prompts = useAppStore((state) => state.prompts);
  const mcpPrompts = useAppStore((state) => state.mcpPrompts);
  const isMobile = useIsMobile();
  const { handleApiError } = useApiError();

  return {
    ...model,
    knowledgebases,
    skills,
    prompts,
    mcpPrompts,
    isMobile,
    handleApiError,
  };
}
