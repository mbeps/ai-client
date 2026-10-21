"use client";

import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LANGUAGES } from "@/config/languages";

export interface LanguagePairToolbarProps {
  sourceLang: (typeof LANGUAGES)[0];
  targetLang: (typeof LANGUAGES)[0];
  sourceLangValue: string;
  onSourceLangChange: (val: string) => void;
  onTargetLangChange: (val: string) => void;
  onSwapLanguages: () => void;
}

/**
 * Toolbar for selecting source and target languages with swap action.
 */
export function LanguagePairToolbar(props: LanguagePairToolbarProps) {
  const {
    sourceLang,
    targetLang,
    sourceLangValue,
    onSourceLangChange,
    onTargetLangChange,
    onSwapLanguages,
  } = props;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg border bg-muted/30 p-1.5 shadow-sm sm:flex-row">
      <div className="w-full flex-1">
        <Combobox
          items={LANGUAGES}
          value={sourceLang}
          onValueChange={(val) =>
            val && onSourceLangChange((val as (typeof LANGUAGES)[0]).value)
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
            onClick={onSwapLanguages}
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
            val && onTargetLangChange((val as (typeof LANGUAGES)[0]).value)
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
  );
}
