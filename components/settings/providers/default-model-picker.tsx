"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setDefaultChatModel } from "@/lib/actions/models/set-default-chat-model";
import { setDefaultEmbeddingModel } from "@/lib/actions/models/set-default-embedding-model";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
import type { UserSettingsRow } from "@/types/user/user-settings-row";
import type { UserModelOption } from "@/hooks/use-user-models";

type ModelItem = {
  id: string;
  label: string;
  providerName: string;
};

type DefaultModelPickerProps = {
  settings: UserSettingsRow | null;
  chatModels: UserModelOption[];
  embeddingModels: UserModelOption[];
  onRefresh: () => Promise<void>;
};

function toItem(model: UserModelOption): ModelItem {
  return {
    id: model.id,
    label: model.label,
    providerName: model.providerName,
  };
}

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

  const handleSetChat = async (item: ModelItem | null): Promise<void> => {
    if (!item || isSaving) return;

    setIsSaving(true);
    try {
      await setDefaultChatModel(item.id);
      invalidateProviderRegistryCache();
      await onRefresh();
      toast.success("Default chat model updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to set chat model",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetEmbedding = async (item: ModelItem | null): Promise<void> => {
    if (!item || isSaving) return;

    setIsSaving(true);
    try {
      await setDefaultEmbeddingModel(item.id);
      invalidateProviderRegistryCache();
      await onRefresh();
      toast.success("Default embedding model updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to set embedding model",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Default Chat Model</CardTitle>
          <CardDescription>
            Used when chat requests do not specify a configured model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Combobox
            items={chatItems}
            value={selectedChat}
            onValueChange={(value) =>
              void handleSetChat((value as ModelItem | null) ?? null)
            }
            itemToStringValue={(value) => (value as ModelItem).label}
            disabled={isSaving || chatItems.length === 0}
          >
            <ComboboxInput
              placeholder={selectedChat?.label ?? "No chat models"}
              showClear={false}
              className="w-full"
            />
            <ComboboxContent className="w-[360px] max-w-full">
              <ComboboxEmpty>No chat models available.</ComboboxEmpty>
              <ComboboxList>
                {(item) => {
                  const model = item as ModelItem;
                  return (
                    <ComboboxItem value={item} key={model.id}>
                      <div className="flex flex-col">
                        <span>{model.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.providerName}
                        </span>
                      </div>
                    </ComboboxItem>
                  );
                }}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Default Embedding Model</CardTitle>
          <CardDescription>
            Used by RAG ingestion and retrieval for all knowledge bases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Combobox
            items={embeddingItems}
            value={selectedEmbedding}
            onValueChange={(value) =>
              void handleSetEmbedding((value as ModelItem | null) ?? null)
            }
            itemToStringValue={(value) => (value as ModelItem).label}
            disabled={isSaving || embeddingItems.length === 0}
          >
            <ComboboxInput
              placeholder={selectedEmbedding?.label ?? "No embedding models"}
              showClear={false}
              className="w-full"
            />
            <ComboboxContent className="w-[360px] max-w-full">
              <ComboboxEmpty>No embedding models available.</ComboboxEmpty>
              <ComboboxList>
                {(item) => {
                  const model = item as ModelItem;
                  return (
                    <ComboboxItem value={item} key={model.id}>
                      <div className="flex flex-col">
                        <span>{model.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.providerName}
                        </span>
                      </div>
                    </ComboboxItem>
                  );
                }}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </CardContent>
      </Card>
    </div>
  );
}
