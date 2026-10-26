import { toast } from "sonner";
import type { getLatestTranslationAction } from "@/actions/workflows/get-latest-translation";
import { triggerTranslation } from "@/actions/workflows/trigger-translation";
import { LANGUAGES } from "@/config/languages";
import type { Attachment } from "@/types/attachment/attachment";

export interface RealtimeTranslationEvent {
  type: string;
  text?: string;
  translatedText?: string;
  message?: string;
}

export type LatestTranslation = NonNullable<
  Awaited<ReturnType<typeof getLatestTranslationAction>>
>;

export interface TranslationHydrationSetters {
  setActiveTranslationId: (id: string | null) => void;
  setSourceText: React.Dispatch<React.SetStateAction<string>>;
  setTranslatedText: React.Dispatch<React.SetStateAction<string>>;
  setIsLoading: (loading: boolean) => void;
  setSourceLangValue: (val: string) => void;
  setTargetLangValue: (val: string) => void;
  setModelId: (val: string) => void;
}

export interface TranslationLanguageSwapSetters {
  setSourceLangValue: (val: string) => void;
  setTargetLangValue: (val: string) => void;
  setSourceText: (text: string) => void;
  setTranslatedText: (text: string) => void;
}

/**
 * Handles incoming realtime SSE events for an active translation stream.
 */
export function applyTranslationRealtimeEvent(
  event: RealtimeTranslationEvent,
  setTranslatedText: React.Dispatch<React.SetStateAction<string>>,
  setIsLoading: (loading: boolean) => void,
): void {
  switch (event.type) {
    case "start":
      setTranslatedText("");
      break;
    case "text-delta":
      if (event.text) {
        setTranslatedText((prev) => prev + event.text);
      }
      break;
    case "finish":
      if (event.translatedText) {
        setTranslatedText(event.translatedText);
      }
      setIsLoading(false);
      break;
    case "error":
      setIsLoading(false);
      toast.error(event.message || "Translation failed");
      break;
  }
}

/**
 * Synchronizes selected language pairs and modelId from a persisted translation record.
 */
function syncLanguagesAndModel(
  latest: LatestTranslation,
  setters: TranslationHydrationSetters,
): void {
  const sLang = LANGUAGES.find((l) => l.label === latest.sourceLanguage);
  if (sLang) setters.setSourceLangValue(sLang.value);
  const tLang = LANGUAGES.find((l) => l.label === latest.targetLanguage);
  if (tLang) setters.setTargetLangValue(tLang.value);
  if (latest.modelId) setters.setModelId(latest.modelId);
}

/**
 * Applies rehydrated translation state upon initial page mount.
 */
export function applyHydratedTranslation(
  latest: LatestTranslation,
  setters: TranslationHydrationSetters,
): void {
  const isOngoing =
    latest.status === "pending" || latest.status === "translating";
  if (isOngoing) {
    setters.setActiveTranslationId(latest.id);
    setters.setSourceText(latest.sourceText);
    setters.setTranslatedText(latest.translatedText || "");
    setters.setIsLoading(true);
    syncLanguagesAndModel(latest, setters);
    return;
  }

  const isCompletedWithText =
    latest.status === "completed" && Boolean(latest.translatedText);
  if (isCompletedWithText) {
    setters.setSourceText((current) => current || latest.sourceText);
    setters.setTranslatedText(
      (current) => current || (latest.translatedText ?? ""),
    );
    syncLanguagesAndModel(latest, setters);
  }
}

/**
 * Maps an uploaded attachment to the translation action payload format.
 */
export function toTranslationAttachmentPayload(attachment: Attachment | null) {
  if (!attachment) return undefined;
  return {
    name: attachment.name,
    type: attachment.type as "image" | "document",
    mimeType: attachment.mimeType,
    dataUrl: attachment.dataUrl,
    extractedText: attachment.extractedText,
  };
}

/**
 * Updates text state based on an extracted document attachment.
 */
export function handleProcessedAttachment(
  processed: Attachment,
  setSourceText: (text: string) => void,
): void {
  if (processed.type !== "document") return;

  if (processed.extractedText?.trim()) {
    setSourceText(processed.extractedText.slice(0, 5000));
  } else {
    toast.warning("No readable text could be extracted from this document.");
  }
}

/**
 * Triggers background translation request and handles error reporting.
 */
export async function executeTranslationRequest(params: {
  sourceText: string;
  sourceLangLabel: string;
  targetLangLabel: string;
  modelId?: string;
  attachment: Attachment | null;
  handleApiError: (err: unknown) => boolean;
  onSuccess: (id: string) => void;
  onError: () => void;
}): Promise<void> {
  try {
    const payloadAttachment = toTranslationAttachmentPayload(params.attachment);
    const { translationId } = await triggerTranslation({
      text: params.sourceText,
      sourceLanguage: params.sourceLangLabel,
      targetLanguage: params.targetLangLabel,
      modelId: params.modelId || undefined,
      attachment: payloadAttachment,
    });
    params.onSuccess(translationId);
  } catch (error: unknown) {
    params.onError();
    if (!params.handleApiError(error)) {
      toast.error(
        error instanceof Error ? error.message : "Translation failed",
      );
    }
  }
}

/**
 * Swaps source and target language and text states.
 */
export function swapLanguageState(
  sourceVal: string,
  targetVal: string,
  sourceText: string,
  translatedText: string,
  setters: TranslationLanguageSwapSetters,
): void {
  if (sourceVal === "auto") return;
  setters.setSourceLangValue(targetVal);
  setters.setTargetLangValue(sourceVal);
  setters.setSourceText(translatedText);
  setters.setTranslatedText(sourceText);
}
