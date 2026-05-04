"use client";

import { useState, useCallback, useMemo } from "react";
import { 
  Languages, 
  ArrowLeftRight, 
  Copy, 
  RotateCcw, 
  Loader2, 
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { MODELS } from "@/constants/models";
import { LANGUAGES, DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE } from "@/constants/languages";
import { translateText } from "@/lib/actions/workflows/translate";
import { Model } from "@/types/model";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Translation workflow page providing AI-powered text translation.
 * Uses a highly space-efficient layout with standard Shadcn UI components.
 * Implements Zod validation via server action and maintains UI consistency.
 *
 * @author Antigravity
 */
export default function TranslationWorkflowPage() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLangValue, setSourceLangValue] = useState(DEFAULT_SOURCE_LANGUAGE);
  const [targetLangValue, setTargetLangValue] = useState(DEFAULT_TARGET_LANGUAGE);
  const [modelId, setModelId] = useState(MODELS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const sourceLang = useMemo(() => 
    LANGUAGES.find(l => l.value === sourceLangValue) || LANGUAGES[0],
    [sourceLangValue]
  );

  const targetLang = useMemo(() => 
    LANGUAGES.find(l => l.value === targetLangValue) || LANGUAGES[1],
    [targetLangValue]
  );

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) {
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
      });
      setTranslatedText(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Translation failed");
    } finally {
      setIsLoading(false);
    }
  }, [sourceText, sourceLang, targetLang, modelId]);

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
  };

  return (
    <div className="flex flex-col space-y-3 h-full max-w-7xl mx-auto overflow-hidden">
      {/* Header Row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Translation</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">Model</span>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Control Bar - Space Efficient */}
      <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 bg-muted/30 p-1.5 rounded-lg border shadow-sm">
        <div className="flex-1 w-full">
          <Combobox
            items={LANGUAGES}
            value={sourceLang}
            onValueChange={(val) => val && setSourceLangValue((val as typeof LANGUAGES[0]).value)}
            itemToStringValue={(l) => (l as typeof LANGUAGES[0]).label}
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
                  <ComboboxItem key={(l as typeof LANGUAGES[0]).value} value={l} className="text-xs">
                    {(l as typeof LANGUAGES[0]).label}
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
            items={LANGUAGES.filter(l => l.value !== "auto")}
            value={targetLang}
            onValueChange={(val) => val && setTargetLangValue((val as typeof LANGUAGES[0]).value)}
            itemToStringValue={(l) => (l as typeof LANGUAGES[0]).label}
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
                  <ComboboxItem key={(l as typeof LANGUAGES[0]).value} value={l} className="text-xs">
                    {(l as typeof LANGUAGES[0]).label}
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
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Type or paste text to translate..."
            className="flex-1 min-h-0 border-0 resize-none focus-visible:ring-0 p-4 text-sm leading-relaxed scrollbar-thin"
          />
          <div className="flex items-center justify-between p-2 border-t bg-muted/10 shrink-0">
            <span className="text-[10px] text-muted-foreground ml-2">
              {sourceText.length} / 5000
            </span>
            {sourceText && (
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
                {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
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
          disabled={isLoading || !sourceText.trim()}
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
