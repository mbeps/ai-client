"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getLatestTranslationAction } from "@/actions/workflows/translate";
import {
  applyHydratedTranslation,
  executeTranslationRequest,
  handleProcessedAttachment,
  swapLanguageState,
} from "@/components/workflows/translation/translation-helpers";
import { useTranslationFormState } from "@/components/workflows/translation/use-translation-form-state";
import { useTranslationRealtimeStream } from "@/components/workflows/translation/use-translation-realtime-stream";
import { useApiError } from "@/hooks/use-api-error";
import { useUserModels } from "@/hooks/use-user-models";
import { processAttachment } from "@/lib/attachments/process-attachment";

function isTranslateActionDisabled(state: {
  isLoading: boolean;
  isExtracting: boolean;
  isModelsLoading: boolean;
  hasNoModels: boolean;
  hasText: boolean;
  isImage: boolean;
}): boolean {
  if (state.isLoading || state.isExtracting) return true;
  if (state.isModelsLoading || state.hasNoModels) return true;
  return !state.hasText && !state.isImage;
}

/**
 * Orchestrates translation form state, model sync, realtime streaming, and user actions.
 */
export function useTranslationWorkflow() {
  const { handleApiError } = useApiError();
  const form = useTranslationFormState();
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");
  const hasNoModels = !isModelsLoading && chatModels.length === 0;
  const [isLoading, setIsLoading] = useState(false);
  const [activeTranslationId, setActiveTranslationId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (chatModels.length === 0) return;
    if (
      form.modelId &&
      chatModels.some((model) => model.modelId === form.modelId)
    ) {
      return;
    }
    form.setModelId(chatModels[0].modelId);
  }, [chatModels, form.modelId, form.setModelId]);

  useTranslationRealtimeStream({
    activeTranslationId,
    isLoading,
    setTranslatedText: form.setTranslatedText,
    setIsLoading,
  });

  useEffect(() => {
    let mounted = true;
    getLatestTranslationAction()
      .then((latest) => {
        if (!mounted || !latest) return;
        applyHydratedTranslation(latest, {
          setActiveTranslationId,
          setSourceText: form.setSourceText,
          setTranslatedText: form.setTranslatedText,
          setIsLoading,
          setSourceLangValue: form.setSourceLangValue,
          setTargetLangValue: form.setTargetLangValue,
          setModelId: form.setModelId,
        });
      })
      .catch(() => {
        // Silently ignore rehydration error
      });
    return () => {
      mounted = false;
    };
  }, [
    form.setSourceText,
    form.setTranslatedText,
    form.setSourceLangValue,
    form.setTargetLangValue,
    form.setModelId,
  ]);

  const handleTranslate = useCallback(async () => {
    const isImage = form.attachment?.type === "image";
    if (!form.sourceText.trim() && !isImage) {
      form.setTranslatedText("");
      return;
    }

    setIsLoading(true);
    form.setTranslatedText("");
    await executeTranslationRequest({
      sourceText: form.sourceText,
      sourceLangLabel: form.sourceLang.label,
      targetLangLabel: form.targetLang.label,
      modelId: form.modelId,
      attachment: form.attachment,
      handleApiError,
      onSuccess: setActiveTranslationId,
      onError: () => setIsLoading(false),
    });
  }, [
    form.sourceText,
    form.sourceLang,
    form.targetLang,
    form.modelId,
    form.attachment,
    form.setTranslatedText,
    handleApiError,
  ]);

  const swapLanguages = () => {
    swapLanguageState(
      form.sourceLangValue,
      form.targetLangValue,
      form.sourceText,
      form.translatedText,
      {
        setSourceLangValue: form.setSourceLangValue,
        setTargetLangValue: form.setTargetLangValue,
        setSourceText: form.setSourceText,
        setTranslatedText: form.setTranslatedText,
      },
    );
  };

  const handleReset = () => {
    form.handleReset();
    setActiveTranslationId(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    form.setIsExtracting(true);
    try {
      const processed = await processAttachment(file, []);
      form.setAttachment(processed);
      handleProcessedAttachment(processed, form.setSourceText);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process file",
      );
    } finally {
      form.setIsExtracting(false);
      if (form.fileInputRef.current) form.fileInputRef.current.value = "";
    }
  };

  const isVisionModel = useMemo(() => {
    const selected = chatModels.find((model) => model.modelId === form.modelId);
    return selected?.capVision ?? false;
  }, [chatModels, form.modelId]);

  const canTranslate = !isTranslateActionDisabled({
    isLoading,
    isExtracting: form.isExtracting,
    isModelsLoading,
    hasNoModels,
    hasText: Boolean(form.sourceText.trim()),
    isImage: form.attachment?.type === "image",
  });

  return {
    sourceText: form.sourceText,
    setSourceText: form.setSourceText,
    translatedText: form.translatedText,
    sourceLang: form.sourceLang,
    targetLang: form.targetLang,
    sourceLangValue: form.sourceLangValue,
    setSourceLangValue: form.setSourceLangValue,
    setTargetLangValue: form.setTargetLangValue,
    modelId: form.modelId,
    setModelId: form.setModelId,
    isLoading,
    isCopied: form.isCopied,
    attachment: form.attachment,
    isExtracting: form.isExtracting,
    fileInputRef: form.fileInputRef,
    hasNoModels,
    isVisionModel,
    swapLanguages,
    handleCopy: form.handleCopy,
    handleReset,
    handleFileSelect,
    removeAttachment: form.removeAttachment,
    handleTranslate,
    canTranslate,
  };
}
