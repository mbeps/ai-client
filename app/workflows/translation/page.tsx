"use client";

import { useRealtime } from "inngest/react";
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
import {
  getLatestTranslationAction,
  getTranslationRealtimeToken,
  triggerTranslation,
} from "@/actions/workflows/translate";
import { ModelSelector } from "@/components/shared/model-selector";
import { PageContainer } from "@/components/shared/page-container";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  LANGUAGES,
} from "@/constants/languages";
import { useApiError } from "@/hooks/use-api-error";
import { useUserModels } from "@/hooks/use-user-models";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { translationChannel } from "@/lib/inngest/channels";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Translation workflow page providing AI-powered text and document translation.
 * Client component supporting language selection, model selection, and file attachment processing.
 * Implements real-time background translation via Inngest with streaming support.
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
  const [activeTranslationId, setActiveTranslationId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedIndexRef = useRef(0);

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

  const apiBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (process.env.NODE_ENV !== "production") {
      return `${window.location.protocol}//${window.location.hostname}:8288`;
    }
    return undefined;
  }, []);

  const fetchTranslationToken = useCallback(async () => {
    if (!activeTranslationId) throw new Error("No active translation");
    return getTranslationRealtimeToken(activeTranslationId);
  }, [activeTranslationId]);

  const { messages } = useRealtime({
    channel: activeTranslationId
      ? translationChannel({ translationId: activeTranslationId })
      : undefined,
    topics: ["stream"] as const,
    token: fetchTranslationToken,
    enabled: !!activeTranslationId && isLoading,
    historyLimit: null,
    apiBaseUrl,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer on translationId change
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
  }, [activeTranslationId]);

  useEffect(() => {
    const all = messages.all;
    if (all.length < lastProcessedIndexRef.current) {
      lastProcessedIndexRef.current = 0;
    }
    if (all.length > lastProcessedIndexRef.current) {
      for (let i = lastProcessedIndexRef.current; i < all.length; i++) {
        const msg = all[i];
        if (msg?.data) {
          const event = msg.data as {
            type: string;
            text?: string;
            translatedText?: string;
            message?: string;
          };
          if (event.type === "start") {
            setTranslatedText("");
          } else if (event.type === "text-delta" && event.text) {
            setTranslatedText((prev) => prev + event.text);
          } else if (event.type === "finish") {
            if (event.translatedText) {
              setTranslatedText(event.translatedText);
            }
            setIsLoading(false);
          } else if (event.type === "error") {
            setIsLoading(false);
            toast.error(event.message || "Translation failed");
          }
        }
      }
      lastProcessedIndexRef.current = all.length;
    }
  }, [messages.all]);

  useEffect(() => {
    let mounted = true;
    getLatestTranslationAction()
      .then((latest) => {
        if (!mounted || !latest) return;
        if (latest.status === "pending" || latest.status === "translating") {
          setActiveTranslationId(latest.id);
          setSourceText(latest.sourceText);
          setTranslatedText(latest.translatedText || "");
          setIsLoading(true);
          const sLang = LANGUAGES.find(
            (l) => l.label === latest.sourceLanguage,
          );
          if (sLang) setSourceLangValue(sLang.value);
          const tLang = LANGUAGES.find(
            (l) => l.label === latest.targetLanguage,
          );
          if (tLang) setTargetLangValue(tLang.value);
          if (latest.modelId) setModelId(latest.modelId);
        } else if (latest.status === "completed" && latest.translatedText) {
          setSourceText((current) => current || latest.sourceText);
          setTranslatedText((current) => current || latest.translatedText);
          const sLang = LANGUAGES.find(
            (l) => l.label === latest.sourceLanguage,
          );
          if (sLang) setSourceLangValue(sLang.value);
          const tLang = LANGUAGES.find(
            (l) => l.label === latest.targetLanguage,
          );
          if (tLang) setTargetLangValue(tLang.value);
          if (latest.modelId) setModelId(latest.modelId);
        }
      })
      .catch(() => {
        // Silently ignore rehydration error
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleTranslate = useCallback(async () => {
    const isImage = attachment?.type === "image";
    if (!sourceText.trim() && !isImage) {
      setTranslatedText("");
      return;
    }

    setIsLoading(true);
    setTranslatedText("");
    try {
      const { translationId } = await triggerTranslation({
        text: sourceText,
        sourceLanguage: sourceLang.label,
        targetLanguage: targetLang.label,
        modelId: modelId || undefined,
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
      setActiveTranslationId(translationId);
    } catch (error: any) {
      setIsLoading(false);
      if (!handleApiError(error)) {
        toast.error(
          error instanceof Error ? error.message : "Translation failed",
        );
      }
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
    setActiveTranslationId(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const processed = await processAttachment(file, []);
      setAttachment(processed);

      if (processed.type === "document") {
        if (processed.extractedText?.trim()) {
          // Truncate to 5000 characters to match schema limits
          setSourceText(processed.extractedText.slice(0, 5000));
        } else {
          toast.warning(
            "No readable text could be extracted from this document.",
          );
        }
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
    <PageContainer
      variant="default"
      scrollable={true}
      className="flex min-h-full flex-col space-y-3 pb-6"
    >
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={swapLanguages}
              disabled={sourceLangValue === "auto"}
              className="h-8 w-8 shrink-0 rounded-full hover:bg-background"
              aria-label="Swap languages"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 rotate-90 transition-transform sm:rotate-0" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Swap languages</TooltipContent>
        </Tooltip>

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
      <div className="relative grid min-h-[360px] flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Source */}
        <div className="group relative flex min-h-[280px] flex-col rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/20">
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
              className="scrollbar-thin min-h-[140px] flex-1 resize-none border-0 p-4 text-sm leading-relaxed focus-visible:ring-0"
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting || !!attachment}
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Attach file"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach file</TooltipContent>
              </Tooltip>
            </div>
            {(sourceText || attachment) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Reset text"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Target */}
        <div className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border bg-muted/5 shadow-sm transition-colors hover:border-primary/20">
          <Textarea
            value={translatedText}
            readOnly
            placeholder={isLoading ? "Translating..." : "Translation..."}
            className="scrollbar-thin min-h-[140px] flex-1 resize-none border-0 bg-transparent p-4 text-sm leading-relaxed focus-visible:ring-0"
          />

          <div className="flex shrink-0 items-center justify-end border-t bg-muted/10 p-2">
            {translatedText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Copy translation"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy translation</TooltipContent>
              </Tooltip>
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
            (!sourceText.trim() && attachment?.type !== "image")
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
    </PageContainer>
  );
}
