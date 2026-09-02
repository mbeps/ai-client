"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  FileText,
  Languages,
  Loader2,
  Paperclip,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/model-selector";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  LANGUAGES,
} from "@/constants/languages";
import { ROUTES } from "@/constants/routes";
import { useApiError } from "@/hooks/use-api-error";
import { useUserModels } from "@/hooks/use-user-models";
import { translateText } from "@/lib/actions/workflows/translate";
import { processAttachment } from "@/lib/attachments/process-attachment";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Translation workflow page providing AI-powered text and document translation.
 * Client component supporting language selection, model selection, and file attachment processing.
 * Implements real-time translation with support for direct text input or document extraction.
 * Maintains copy-to-clipboard functionality and language pair swapping.
 *
 * @author Maruf Bepary
 */
export default function TranslationWorkflowPage() {
  const router = useRouter();
  const { handleApiError } = useApiError();
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLangValue, setSourceLangValue] = useState(
    DEFAULT_SOURCE_LANGUAGE,
  );
  const [targetLangValue, setTargetLangValue] = useState(
    DEFAULT_TARGET_LANGUAGE,
  );
  const { models: chatModels } = useUserModels("chat");
  const hasNoModels = chatModels.length === 0;
  const [modelId, setModelId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatModels.length === 0) return;
    if (modelId && chatModels.some((model) => model.modelId === modelId)) {
      return;
    }
    setModelId(chatModels[0].modelId);
  }, [chatModels, modelId]);

  const sourceLang = useMemo(
    () => LANGUAGES.find((l) => l.value === sourceLangValue) || LANGUAGES[0],
    [sourceLangValue],
  );

  const targetLang = useMemo(
    () => LANGUAGES.find((l) => l.value === targetLangValue) || LANGUAGES[1],
    [targetLangValue],
  );

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() && !attachment) {
      setTranslatedText("");
      return;
    }

    setIsLoading(true);
    try {
      const result = await translateText({
        text: sourceText,
        sourceLanguage: sourceLang.label,
        targetLanguage: targetLang.label,
        modelId: modelId,
        attachment: attachment
          ? {
              name: attachment.name,
              type: attachment.type as "image" | "document",
              mimeType: attachment.mimeType,
              dataUrl: attachment.dataUrl,
              extractedText: attachment.extractedText,
            }
          : undefined,
      });
      setTranslatedText(result);
    } catch (error: any) {
      if (!handleApiError(error)) {
        toast.error(
          error instanceof Error ? error.message : "Translation failed",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [sourceText, sourceLang, targetLang, modelId, attachment, handleApiError]);

  const swapLanguages = () => {
    if (sourceLangValue === "auto") return;
    const prevSource = sourceLangValue;
    setSourceLangValue(targetLangValue);
    setTargetLangValue(prevSource);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReset = () => {
    setSourceText("");
    setTranslatedText("");
    setAttachment(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const processed = await processAttachment(file, []);
      setAttachment(processed);

      if (processed.type === "document" && processed.extractedText) {
        // Truncate to 5000 characters to match schema limits
        setSourceText(processed.extractedText.slice(0, 5000));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process file",
      );
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const isVisionModel = useMemo(() => {
    const selected = chatModels.find((model) => model.modelId === modelId);
    return selected?.capVision ?? false;
  }, [chatModels, modelId]);

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col space-y-3 overflow-hidden">
      {/* Header Row */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h1 className="font-semibold text-lg">Translation</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[10px] text-muted-foreground uppercase">
            Model
          </span>
          <ModelSelector
            value={modelId}
            onValueChange={setModelId}
            className="w-[140px]"
          />
        </div>
      </div>

      {/* Global Banner for Missing Models */}
      {hasNoModels && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="font-medium text-red-800 text-xs dark:text-red-200">
              No AI models configured. Please set up a provider to use
              translation.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-red-200 text-[10px] hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
            onClick={() => router.push(ROUTES.SETTINGS.PROVIDERS.path)}
          >
            <Settings className="mr-1.5 h-3 w-3" />
            Go to Settings
          </Button>
        </div>
      )}

      {/* Control Bar - Space Efficient */}
      <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg border bg-muted/30 p-1.5 shadow-sm sm:flex-row">
        <div className="w-full flex-1">
          <Combobox
            items={LANGUAGES}
            value={sourceLang}
            onValueChange={(val) =>
              val && setSourceLangValue((val as (typeof LANGUAGES)[0]).value)
            }
            itemToStringValue={(l) => (l as (typeof LANGUAGES)[0]).label}
          >
            <ComboboxInput
              placeholder={sourceLang.label}
              className="h-8 w-full text-xs"
              showClear={false}
            />
            <ComboboxContent className="w-56">
              <ComboboxEmpty>No languages found.</ComboboxEmpty>
              <ComboboxList>
                {(l) => (
                  <ComboboxItem
                    key={(l as (typeof LANGUAGES)[0]).value}
                    value={l}
                    className="text-xs"
                  >
                    {(l as (typeof LANGUAGES)[0]).label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={swapLanguages}
          disabled={sourceLangValue === "auto"}
          className="h-8 w-8 shrink-0 rounded-full hover:bg-background"
          title="Swap"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 rotate-90 transition-transform sm:rotate-0" />
        </Button>

        <div className="w-full flex-1">
          <Combobox
            items={LANGUAGES.filter((l) => l.value !== "auto")}
            value={targetLang}
            onValueChange={(val) =>
              val && setTargetLangValue((val as (typeof LANGUAGES)[0]).value)
            }
            itemToStringValue={(l) => (l as (typeof LANGUAGES)[0]).label}
          >
            <ComboboxInput
              placeholder={targetLang.label}
              className="h-8 w-full text-xs"
              showClear={false}
            />
            <ComboboxContent className="w-56">
              <ComboboxEmpty>No languages found.</ComboboxEmpty>
              <ComboboxList>
                {(l) => (
                  <ComboboxItem
                    key={(l as (typeof LANGUAGES)[0]).value}
                    value={l}
                    className="text-xs"
                  >
                    {(l as (typeof LANGUAGES)[0]).label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      {/* Editor Grid - Maximum Height */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Source */}
        <div className="group relative flex flex-col rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/20">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,image/*"
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={
                attachment?.type === "image"
                  ? "Vision mode: Image attached. Add notes if needed..."
                  : "Type or paste text to translate..."
              }
              className="scrollbar-thin min-h-0 flex-1 resize-none border-0 p-4 text-sm leading-relaxed focus-visible:ring-0"
              disabled={isExtracting}
            />

            {attachment && (
              <div className="px-4 pb-3">
                <div className="group/attach flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10">
                    {attachment.type === "image" ? (
                      <div className="relative h-10 w-10">
                        <Image
                          src={attachment.dataUrl}
                          fill
                          className="rounded object-cover"
                          alt="Preview"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-xs">
                      {attachment.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {attachment.type}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeAttachment}
                    className="h-7 w-7 opacity-0 transition-opacity group-hover/attach:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {attachment.type === "image" && !isVisionModel && (
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[10px] text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      Selected model might not support vision. OCR may fail.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t bg-muted/10 p-2">
            <div className="flex items-center gap-1">
              <span className="ml-2 text-[10px] text-muted-foreground">
                {sourceText.length} / 5000
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting || !!attachment}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                title="Attach file"
              >
                {isExtracting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {(sourceText || attachment) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Target */}
        <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-muted/5 shadow-sm transition-colors hover:border-primary/20">
          <Textarea
            value={translatedText}
            readOnly
            placeholder={isLoading ? "Translating..." : "Translation..."}
            className="scrollbar-thin min-h-0 flex-1 resize-none border-0 bg-transparent p-4 text-sm leading-relaxed focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center justify-end border-t bg-muted/10 p-2">
            {translatedText && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                title="Copy"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
          {isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Action Row - Small and Aligned */}
      <div className="flex shrink-0 justify-end pt-1">
        <Button
          size="sm"
          onClick={handleTranslate}
          disabled={
            isLoading ||
            isExtracting ||
            hasNoModels ||
            (!sourceText.trim() && !attachment)
          }
          className="h-8 px-8 font-medium text-xs shadow-sm transition-all"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="mr-2 h-3.5 w-3.5" />
          )}
          {isLoading ? "Translating..." : "Translate"}
        </Button>
      </div>
    </div>
  );
}
