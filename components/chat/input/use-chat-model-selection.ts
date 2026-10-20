import { useEffect, useMemo, useState } from "react";

export interface ModelCapabilityItem {
  id?: string;
  modelId: string;
  name?: string;
  capVision?: boolean;
  capTools?: boolean;
}

function resolveInitialModelSelection(
  chatModels: Array<{ id?: string; modelId: string }>,
  currentModelId: string,
  initialModelId?: string,
): string {
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
 */
export function useChatModelSelection(
  chatModels: ModelCapabilityItem[],
  isModelsLoading: boolean,
  initialModelId?: string,
) {
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");
  const hasNoModels = chatModels.length === 0 && !isModelsLoading;

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

    Promise.resolve().then(() => {
      setModelId((current) =>
        resolveInitialModelSelection(chatModels, current, initialModelId),
      );
    });
  }, [chatModels, initialModelId, isModelsLoading]);

  return {
    modelId,
    setModelId,
    selectedModelObj,
    supportsVision,
    supportsTools,
    hasNoModels,
  };
}
