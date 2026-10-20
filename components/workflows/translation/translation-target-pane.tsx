"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TranslationTargetPaneProps {
  translatedText: string;
  isLoading: boolean;
  isCopied: boolean;
  onCopy: () => void;
}

/**
 * Target output pane displaying streaming translation result with copy action.
 */
export function TranslationTargetPane(props: TranslationTargetPaneProps) {
  const { translatedText, isLoading, isCopied, onCopy } = props;

  return (
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
                onClick={onCopy}
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
  );
}
