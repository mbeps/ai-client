"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Languages,
  ArrowLeftRight,
  Copy,
  RotateCcw,
  Loader2,
  Check,
  Paperclip,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  LANGUAGES,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from "@/constants/languages";
import { ROUTES } from "@/constants/routes";
import { translateText } from "@/lib/actions/workflows/translate";
import { ModelSelector } from "@/components/shared/model-selector";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { processAttachment } from "@/lib/attachments/process-attachment";
import type { Attachment } from "@/types/attachment/attachment";
import { useApiError } from "@/hooks/use-api-error";
import { useUserModels } from "@/hooks/use-user-models";

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
    <div className="flex flex-col space-y-3 h-full max-w-7xl mx-auto overflow-hidden">
      {/* Header Row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Translation</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
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
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-xs font-medium text-red-800 dark:text-red-200">
              No AI models configured. Please set up a provider to use
              translation.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] border-red-200 hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
            onClick={() => router.push(ROUTES.SETTINGS.PROVIDERS.path)}
          >
            Go to Settings
          </Button>
        </div>
      )}

      {/* Control Bar - Space Efficient */}
      <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 bg-muted/30 p-1.5 rounded-lg border shadow-sm">
        <div className="flex-1 w-full">
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
              className="h-8 text-xs w-full"
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
          className="rounded-full h-8 w-8 hover:bg-background shrink-0"
          title="Swap"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 rotate-90 sm:rotate-0 transition-transform" />
        </Button>

        <div className="flex-1 w-full">
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
              className="h-8 text-xs w-full"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 relative">
        {/* Source */}
        <div className="relative group flex flex-col border rounded-xl bg-card shadow-sm hover:border-primary/20 transition-colors">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,image/*"
          />

          <div className="flex-1 flex flex-col min-h-0 relative">
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={
                attachment?.type === "image"
                  ? "Vision mode: Image attached. Add notes if needed..."
                  : "Type or paste text to translate..."
              }
              className="flex-1 min-h-0 border-0 resize-none focus-visible:ring-0 p-4 text-sm leading-relaxed scrollbar-thin"
              disabled={isExtracting}
            />

            {attachment && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 group/attach">
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    {attachment.type === "image" ? (
                      <div className="relative h-10 w-10">
                        <Image
                          src={attachment.dataUrl}
                          fill
                          className="object-cover rounded"
                          alt="Preview"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
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
                    className="h-7 w-7 opacity-0 group-hover/attach:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {attachment.type === "image" && !isVisionModel && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-200">
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      Selected model might not support vision. OCR may fail.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-2 border-t bg-muted/10 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground ml-2">
                {sourceText.length} / 5000
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting || !!attachment}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
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
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Target */}
        <div className="relative group flex flex-col border rounded-xl bg-muted/5 shadow-sm hover:border-primary/20 transition-colors overflow-hidden">
          <Textarea
            value={translatedText}
            readOnly
            placeholder={isLoading ? "Translating..." : "Translation..."}
            className="flex-1 min-h-0 border-0 resize-none focus-visible:ring-0 p-4 text-sm leading-relaxed scrollbar-thin bg-transparent"
          />
          <div className="flex items-center justify-end p-2 border-t bg-muted/10 shrink-0">
            {translatedText && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
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
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Action Row - Small and Aligned */}
      <div className="flex justify-end pt-1 shrink-0">
        <Button
          size="sm"
          onClick={handleTranslate}
          disabled={
            isLoading ||
            isExtracting ||
            hasNoModels ||
            (!sourceText.trim() && !attachment)
          }
          className="px-8 h-8 text-xs font-medium shadow-sm transition-all"
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
