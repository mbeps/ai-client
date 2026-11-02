"use client";

import { Languages, Loader2 } from "lucide-react";
import { ModelSelector } from "@/components/shared/model-selector";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { PageContainer } from "@/components/shared/page-container";
import { Button } from "@/components/ui/button";
import { LanguagePairToolbar } from "@/components/workflows/translation/language-pair-toolbar";
import { TranslationSourcePane } from "@/components/workflows/translation/translation-source-pane";
import { TranslationTargetPane } from "@/components/workflows/translation/translation-target-pane";
import { useTranslationWorkflow } from "@/components/workflows/translation/use-translation-workflow";

/**
 * Translation workflow page providing AI-powered text and document translation.
 * Client component supporting language selection, model selection, and file attachment processing.
 * Implements real-time background translation via Inngest with streaming support.
 * Maintains copy-to-clipboard functionality and language pair swapping.
 *
 * @author Maruf Bepary
 */
export default function TranslationWorkflowPage() {
  const workflow = useTranslationWorkflow();

  return (
    <PageContainer
      variant="default"
      scrollable={true}
      className="flex min-h-full flex-col space-y-3 pb-6"
    >
      {/* Header Row */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="text-primary h-4 w-4" />
          <h1 className="text-lg font-semibold">Translation</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[10px] font-medium uppercase">
            Model
          </span>
          <ModelSelector
            value={workflow.modelId}
            onValueChange={workflow.setModelId}
            className="w-[140px]"
          />
        </div>
      </div>

      {/* Global Banner for Missing Models */}
      {workflow.hasNoModels && (
        <NoModelsAlertBanner message="No AI models configured. Please set up a provider to use translation." />
      )}

      {/* Control Bar - Space Efficient */}
      <LanguagePairToolbar
        sourceLang={workflow.sourceLang}
        targetLang={workflow.targetLang}
        sourceLangValue={workflow.sourceLangValue}
        onSourceLangChange={workflow.setSourceLangValue}
        onTargetLangChange={workflow.setTargetLangValue}
        onSwapLanguages={workflow.swapLanguages}
      />

      {/* Editor Grid - Maximum Height */}
      <div className="relative grid min-h-[360px] flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <TranslationSourcePane
          sourceText={workflow.sourceText}
          onSourceTextChange={workflow.setSourceText}
          attachment={workflow.attachment}
          onRemoveAttachment={workflow.removeAttachment}
          isVisionModel={workflow.isVisionModel}
          isExtracting={workflow.isExtracting}
          fileInputRef={workflow.fileInputRef}
          onFileSelect={workflow.handleFileSelect}
          onReset={workflow.handleReset}
        />

        <TranslationTargetPane
          translatedText={workflow.translatedText}
          isLoading={workflow.isLoading}
          isCopied={workflow.isCopied}
          onCopy={workflow.handleCopy}
        />
      </div>

      {/* Action Row - Small and Aligned */}
      <div className="flex shrink-0 justify-end pt-1">
        <Button
          size="sm"
          onClick={workflow.handleTranslate}
          disabled={!workflow.canTranslate}
          className="h-8 px-8 text-xs font-medium shadow-sm transition-all"
        >
          {workflow.isLoading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="mr-2 h-3.5 w-3.5" />
          )}
          {workflow.isLoading ? "Translating..." : "Translate"}
        </Button>
      </div>
    </PageContainer>
  );
}
