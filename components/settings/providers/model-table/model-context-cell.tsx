"use client";

import type { AiModelRow } from "@/types/provider/ai-model-row";

/**
 * Renders the model context cell component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ModelContextCell({ model }: { model: AiModelRow }) {
  const showDims =
    model.modelType === "embedding" || model.modelType === "both";
  return (
    <div className="text-xs">
      <div>{model.contextWindow.toLocaleString()} tokens</div>
      {showDims && (
        <div className="text-muted-foreground">
          {model.embeddingDimensions ?? "-"} dims
        </div>
      )}
    </div>
  );
}
