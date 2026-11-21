"use client";

import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { setDefaultChatModel } from "@/actions/models/set-default-chat-model";
import { setDefaultEmbeddingModel } from "@/actions/models/set-default-embedding-model";
import { setDefaultKbModel } from "@/actions/models/set-default-kb-model";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserModelOption } from "@/hooks/use-user-models";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

const DEFAULT_KB_SENTINEL = "__default_chat__";

/**
 * Represents model item.
 *
 * @author Maruf Bepary
 */
type ModelItem = {
  id: string;
  label: string;
  providerName: string;
};

/**
 * Represents default model picker props.
 *
 * @author Maruf Bepary
 */
type DefaultModelPickerProps = {
  settings: UserSettingsRow | null;
  chatModels: UserModelOption[];
  embeddingModels: UserModelOption[];
  onRefresh: () => Promise<void>;
};

/**
 * Props for a single default model selector row.
 *
 * @author Maruf Bepary
 */
type ModelSelectRowProps = {
  title: string;
  description: string;
  items: ModelItem[];
  value: ModelItem | null;
  placeholder: string;
  emptyText: string;
  disabled: boolean;
  onSelect: (item: ModelItem) => void;
};

/**
 * Performs to item.
 *
 * @param model - Target model
 * @returns The resolved result
 * @author Maruf Bepary
 */
function toItem(model: UserModelOption): ModelItem {
  return {
    id: model.id,
    label: model.label,
    providerName: model.providerName,
  };
}

/**
 * Reusable row containing a labelled combobox selector and tooltip description for a model default.
 *
 * @author Maruf Bepary
 */
function ModelSelectRow({
  title,
  description,
  items,
  value,
  placeholder,
  emptyText,
  disabled,
  onSelect,
}: ModelSelectRowProps) {
  return (
    <div
      data-slot="default-model-row"
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${title} description`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center"
            >
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{description}</TooltipContent>
        </Tooltip>
      </div>
      <div className="w-full sm:w-72 sm:shrink-0">
        <Combobox
          items={items}
          value={value}
          onValueChange={(nextValue) => onSelect(nextValue as ModelItem)}
          itemToStringValue={(item) => (item as ModelItem).label}
          disabled={disabled}
        >
          <ComboboxInput
            placeholder={placeholder}
            showClear={false}
            className="w-full"
          />
          <ComboboxContent className="w-90 max-w-full">
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            <ComboboxList>
              {(item) => {
                const model = item as ModelItem;
                return (
                  <ComboboxItem value={item} key={model.id}>
                    <div className="flex flex-col">
                      <span>{model.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {model.providerName}
                      </span>
                    </div>
                  </ComboboxItem>
                );
              }}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
}

/**
 * Dropdown selectors for default chat, embedding, and knowledge base models.
 * Allows users to set which models to use by default across the application.
 * Triggers cache invalidation on selection change.
 *
 * @param props.settings - Current user settings containing default model IDs.
 * @param props.chatModels - Available chat models to select from.
 * @param props.embeddingModels - Available embedding models to select from.
 * @param props.onRefresh - Callback to refresh settings after model selection.
 * @author Maruf Bepary
 */
export function DefaultModelPicker({
  settings,
  chatModels,
  embeddingModels,
  onRefresh,
}: DefaultModelPickerProps) {
  const [isSaving, setIsSaving] = useState(false);

  const chatItems = useMemo(() => chatModels.map(toItem), [chatModels]);
  const embeddingItems = useMemo(
    () => embeddingModels.map(toItem),
    [embeddingModels],
  );
  const kbItems = useMemo<ModelItem[]>(
    () => [
      {
        id: DEFAULT_KB_SENTINEL,
        label: "Use Default Chat Model",
        providerName: "Inherits Default Chat Model",
      },
      ...chatItems,
    ],
    [chatItems],
  );

  const selectedChat =
    chatItems.find((item) => item.id === settings?.defaultChatModelId) ??
    chatItems[0] ??
    null;
  const selectedEmbedding =
    embeddingItems.find(
      (item) => item.id === settings?.defaultEmbeddingModelId,
    ) ??
    embeddingItems[0] ??
    null;
  const selectedKb =
    kbItems.find((item) => item.id === settings?.defaultKbModelId) ??
    kbItems[0];

  const applyDefaultUpdate = async (
    action: () => Promise<Result<void, CommonError>>,
    fallbackError: string,
    successMessage: string,
  ): Promise<void> => {
    setIsSaving(true);
    try {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error.message || fallbackError);
        return;
      }
      invalidateProviderRegistryCache();
      await onRefresh();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallbackError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="divide-y rounded-lg border">
      <ModelSelectRow
        title="Default Chat Model"
        description="Used when chat requests do not specify a configured model."
        items={chatItems}
        value={selectedChat}
        placeholder={selectedChat?.label ?? "No chat models"}
        emptyText="No chat models available."
        disabled={isSaving || chatItems.length === 0}
        onSelect={(item) =>
          void applyDefaultUpdate(
            () => setDefaultChatModel(item.id),
            "Failed to set chat model",
            "Default chat model updated",
          )
        }
      />

      <ModelSelectRow
        title="Default Embedding Model"
        description="Used by RAG ingestion and retrieval for all knowledge bases."
        items={embeddingItems}
        value={selectedEmbedding}
        placeholder={selectedEmbedding?.label ?? "No embedding models"}
        emptyText="No embedding models available."
        disabled={isSaving || embeddingItems.length === 0}
        onSelect={(item) =>
          void applyDefaultUpdate(
            () => setDefaultEmbeddingModel(item.id),
            "Failed to set embedding model",
            "Default embedding model updated",
          )
        }
      />

      <ModelSelectRow
        title="Default Knowledge Base Model"
        description="Used to extract document metadata and relations when ingesting documents."
        items={kbItems}
        value={selectedKb}
        placeholder={selectedKb.label}
        emptyText="No chat models available."
        disabled={isSaving || chatItems.length === 0}
        onSelect={(item) =>
          void applyDefaultUpdate(
            () =>
              setDefaultKbModel(
                item.id === DEFAULT_KB_SENTINEL ? null : item.id,
              ),
            "Failed to set knowledge base model",
            "Default knowledge base model updated",
          )
        }
      />
    </div>
  );
}
