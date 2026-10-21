"use client";

import {
  AlertCircle,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";
import Image from "next/image";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Attachment } from "@/types/attachment/attachment";

export interface TranslationSourcePaneProps {
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  attachment: Attachment | null;
  onRemoveAttachment: () => void;
  isVisionModel: boolean;
  isExtracting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

/**
 * Source input pane with file upload, document preview, and character counter.
 */
export function TranslationSourcePane(props: TranslationSourcePaneProps) {
  const {
    sourceText,
    onSourceTextChange,
    attachment,
    onRemoveAttachment,
    isVisionModel,
    isExtracting,
    fileInputRef,
    onFileSelect,
    onReset,
  } = props;

  const isImageAttachment = attachment?.type === "image";
  const placeholder = isImageAttachment
    ? "Vision mode: Image attached. Add notes if needed..."
    : "Type or paste text to translate...";

  return (
    <div className="group relative flex min-h-[280px] flex-col rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/20">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        className="hidden"
        accept=".pdf,.txt,.md,image/*"
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Textarea
          value={sourceText}
          onChange={(e) => onSourceTextChange(e.target.value)}
          placeholder={placeholder}
          className="scrollbar-thin min-h-[140px] flex-1 resize-none border-0 p-4 text-sm leading-relaxed focus-visible:ring-0"
          disabled={isExtracting}
        />

        {attachment && (
          <div className="px-4 pb-3">
            <div className="group/attach flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10">
                {isImageAttachment ? (
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
                onClick={onRemoveAttachment}
                className="h-7 w-7 opacity-0 transition-opacity group-hover/attach:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isImageAttachment && !isVisionModel && (
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
                onClick={onReset}
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
  );
}
