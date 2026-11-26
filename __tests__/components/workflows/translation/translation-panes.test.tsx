import { fireEvent, render, screen } from "@testing-library/react";
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

  it("covers image attachment, non-vision warning, extracting, reset, and target loading/copied states", () => {
    const onSourceTextChange = vi.fn();
    const onRemoveAttachment = vi.fn();
    const onReset = vi.fn();
    const onCopy = vi.fn();
    const fileInputRef = createRef<HTMLInputElement>();

    render(
      <TooltipProvider>
        <TranslationSourcePane
          sourceText="Hello"
          onSourceTextChange={onSourceTextChange}
          attachment={{
            id: "img-1",
            name: "photo.png",
            type: "image",
            mimeType: "image/png",
            size: 100,
            dataUrl: "data:image/png;base64,AA==",
          }}
          onRemoveAttachment={onRemoveAttachment}
          isExtracting={true}
          isVisionModel={false}
          fileInputRef={fileInputRef}
          onFileSelect={vi.fn()}
          onReset={onReset}
        />
        <TranslationTargetPane
          translatedText="Hola"
          isLoading={true}
          isCopied={true}
          onCopy={onCopy}
        />
      </TooltipProvider>,
    );

    const sourceTextarea = screen.getByPlaceholderText(
      "Vision mode: Image attached. Add notes if needed...",
    );
    fireEvent.change(sourceTextarea, { target: { value: "World" } });
    expect(onSourceTextChange).toHaveBeenCalledWith("World");

    expect(
      screen.getByText("Selected model might not support vision. OCR may fail."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset text" }));
    expect(onReset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));

    expect(screen.getByPlaceholderText("Translating...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy translation" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("covers document attachment and uncopied target state", () => {
    render(
      <TooltipProvider>
        <TranslationSourcePane
          sourceText=""
          onSourceTextChange={vi.fn()}
          attachment={{
            id: "doc-1",
            name: "notes.pdf",
            type: "document",
            mimeType: "application/pdf",
            size: 200,
            dataUrl: "data:application/pdf;base64,AA==",
          }}
          onRemoveAttachment={vi.fn()}
          isExtracting={false}
          isVisionModel={true}
          fileInputRef={createRef<HTMLInputElement>()}
          onFileSelect={vi.fn()}
          onReset={vi.fn()}
        />
        <TranslationTargetPane
          translatedText="Bonjour"
          isLoading={false}
          isCopied={false}
          onCopy={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy translation" })).toBeInTheDocument();
  });

  it("triggers file input click when Attach file is clicked without attachment", () => {
    const fileInputRef = createRef<HTMLInputElement>();
    render(
      <TooltipProvider>
        <TranslationSourcePane
          sourceText=""
          onSourceTextChange={vi.fn()}
          attachment={null}
          onRemoveAttachment={vi.fn()}
          isExtracting={false}
          isVisionModel={false}
          fileInputRef={fileInputRef}
          onFileSelect={vi.fn()}
          onReset={vi.fn()}
        />
      </TooltipProvider>,
    );
    const clickSpy = vi.spyOn(fileInputRef.current!, "click");
    fireEvent.click(screen.getByRole("button", { name: "Attach file" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
