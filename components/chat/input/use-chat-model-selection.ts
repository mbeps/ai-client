import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";

/**
 * Represents model capability item.
 *
 * @author Maruf Bepary
 */
export interface ModelCapabilityItem {
  id?: string;
  modelId: string;
  name?: string;
  capVision?: boolean;
  capTools?: boolean;
  capReasoning?: boolean;
  reasoningEffortFormat?: ReasoningEffortFormat;
  modelOptions?: string | null;
}

/**
 * Resolves initial model selection.
 *
 * @param chatModels - Target chat models
 * @param currentModelId - Target current model id
 * @param initialModelId - Target initial model id
 * @param preferInitialModel - Whether newly hydrated initialModelId should take precedence over fallback selection
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveInitialModelSelection(
  chatModels: Array<{ id?: string; modelId: string }>,
  currentModelId: string,
  initialModelId?: string,
  preferInitialModel = false,
): string {
  if (preferInitialModel && initialModelId) {
    const match = chatModels.find(
      (m) => m.modelId === initialModelId || m.id === initialModelId,
    );
    if (match) return match.modelId;
  }
  if (currentModelId && chatModels.some((m) => m.modelId === currentModelId)) {
    return currentModelId;
  }
  if (initialModelId) {
    const match = chatModels.find(
      (m) => m.modelId === initialModelId || m.id === initialModelId,
    );
    if (match) return match.modelId;
  }
  return chatModels[0]?.modelId ?? "";
}

/**
 * Manages model selection, model resolution on load, and vision/tools capability flags.
 *
 * @param chatModels - Target chat models
 * @param isModelsLoading - Target is models loading
 * @param initialModelId - Target initial model id
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatModelSelection(
  chatModels: ModelCapabilityItem[],
  isModelsLoading: boolean,
  initialModelId?: string,
) {
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");
  const hasManualSelectionRef = useRef(false);
  const lastInitialModelIdRef = useRef<string | undefined>(initialModelId);
  const hasNoModels = chatModels.length === 0 && !isModelsLoading;

  const selectModel = useCallback((nextModelId: string) => {
    hasManualSelectionRef.current = true;
    setModelId(nextModelId);
  }, []);

  const selectedModelObj = useMemo(
    () => chatModels.find((model) => model.modelId === modelId) ?? null,
    [chatModels, modelId],
  );

  const supportsVision = Boolean(selectedModelObj?.capVision);

  const supportsTools = useMemo(() => {
    if (isModelsLoading && modelId && !selectedModelObj) return true;
    return selectedModelObj?.capTools ?? false;
  }, [selectedModelObj, isModelsLoading, modelId]);

  useEffect(() => {
    if (chatModels.length === 0 || isModelsLoading) return;

    const initialChanged = lastInitialModelIdRef.current !== initialModelId;
    lastInitialModelIdRef.current = initialModelId;
    const preferInitial = initialChanged && !hasManualSelectionRef.current;

    Promise.resolve().then(() => {
      setModelId((current) =>
        resolveInitialModelSelection(
          chatModels,
          current,
          initialModelId,
          preferInitial,
        ),
      );
    });
  }, [chatModels, initialModelId, isModelsLoading]);

  return {
    modelId,
    setModelId: selectModel,
    selectedModelObj,
    supportsVision,
    supportsTools,
    hasNoModels,
  };
}
