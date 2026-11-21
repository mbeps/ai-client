import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranslationSourcePane } from "@/components/workflows/translation/translation-source-pane";
import { TranslationTargetPane } from "@/components/workflows/translation/translation-target-pane";

describe("Translation panes dark mode surface parity", () => {
  it("uses bg-transparent and dark:bg-transparent on source and target textareas", () => {
    render(
      <TooltipProvider>
        <TranslationSourcePane
          sourceText=""
          onSourceTextChange={vi.fn()}
          attachment={null}
          onRemoveAttachment={vi.fn()}
          isExtracting={false}
          isLoading={false}
          isListening={false}
          isSpeechSupported={false}
          onToggleListening={vi.fn()}
          fileInputRef={createRef<HTMLInputElement>()}
          onFileSelect={vi.fn()}
          onTranslate={vi.fn()}
        />
        <TranslationTargetPane
          translatedText=""
          isLoading={false}
          isCopied={false}
          onCopy={vi.fn()}
        />
      </TooltipProvider>,
    );

    const sourceTextarea = screen.getByPlaceholderText(
      "Type or paste text to translate...",
    );
    const targetTextarea = screen.getByPlaceholderText("Translation...");

    expect(sourceTextarea).toHaveClass("bg-transparent", "dark:bg-transparent");
    expect(targetTextarea).toHaveClass("bg-transparent", "dark:bg-transparent");
  });
});
