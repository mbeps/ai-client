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
    <div className="group bg-muted/5 hover:border-primary/20 relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border shadow-sm transition-colors">
      <Textarea
        value={translatedText}
        readOnly
        placeholder={isLoading ? "Translating..." : "Translation..."}
        className="min-h-[140px] flex-1 resize-none scrollbar-thin border-0 bg-transparent p-4 text-sm leading-relaxed focus-visible:ring-0"
      />

      <div className="bg-muted/10 flex shrink-0 items-center justify-end border-t p-2">
        {translatedText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopy}
                className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
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
        <div className="bg-background/20 pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
          <Loader2 className="text-primary/50 h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
