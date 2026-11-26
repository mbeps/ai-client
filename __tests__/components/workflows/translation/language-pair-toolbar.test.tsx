import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguagePairToolbar } from "@/components/workflows/translation/language-pair-toolbar";
import { LANGUAGES } from "@/config/languages";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    items,
    onValueChange,
    itemToStringValue,
    children,
  }: {
    items: unknown[];
    onValueChange: (val: unknown) => void;
    itemToStringValue: (item: unknown) => string;
    children: React.ReactNode;
  }) => (
    <div data-testid="combobox">
      {items.map((item, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onValueChange(item)}
        >
          {itemToStringValue(item)}
        </button>
      ))}
      <button type="button" onClick={() => onValueChange(null)}>
        clear
      </button>
      {children}
    </div>
  ),
  ComboboxInput: ({ placeholder }: { placeholder: string }) => (
    <input placeholder={placeholder} readOnly />
  ),
  ComboboxContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComboboxEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComboboxList: ({ children }: { children: (item: unknown) => React.ReactNode }) => (
    <div>{children(LANGUAGES[1])}</div>
  ),
  ComboboxItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("LanguagePairToolbar", () => {
  it("renders source and target comboboxes and handles selection and swap", () => {
    const onSourceLangChange = vi.fn();
    const onTargetLangChange = vi.fn();
    const onSwapLanguages = vi.fn();

    render(
      <LanguagePairToolbar
        sourceLang={LANGUAGES[1]}
        targetLang={LANGUAGES[2]}
        sourceLangValue={LANGUAGES[1].value}
        onSourceLangChange={onSourceLangChange}
        onTargetLangChange={onTargetLangChange}
        onSwapLanguages={onSwapLanguages}
      />,
    );

    const swapBtn = screen.getByRole("button", { name: "Swap languages" });
    expect(swapBtn).not.toBeDisabled();
    fireEvent.click(swapBtn);
    expect(onSwapLanguages).toHaveBeenCalledTimes(1);

    const comboboxes = screen.getAllByTestId("combobox");
    // Source combobox: click first language and clear
    const sourceButtons = comboboxes[0].querySelectorAll("button");
    fireEvent.click(sourceButtons[0]);
    expect(onSourceLangChange).toHaveBeenCalledWith(LANGUAGES[0].value);
    fireEvent.click(sourceButtons[sourceButtons.length - 1]); // null value
    expect(onSourceLangChange).toHaveBeenCalledTimes(1);

    // Target combobox: click first non-auto language and clear
    const targetButtons = comboboxes[1].querySelectorAll("button");
    fireEvent.click(targetButtons[0]);
    expect(onTargetLangChange).toHaveBeenCalledWith(LANGUAGES[1].value);
    fireEvent.click(targetButtons[targetButtons.length - 1]); // null value
    expect(onTargetLangChange).toHaveBeenCalledTimes(1);
  });

  it("disables swap button when sourceLangValue is auto", () => {
    render(
      <LanguagePairToolbar
        sourceLang={LANGUAGES[0]}
        targetLang={LANGUAGES[1]}
        sourceLangValue="auto"
        onSourceLangChange={vi.fn()}
        onTargetLangChange={vi.fn()}
        onSwapLanguages={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Swap languages" })).toBeDisabled();
  });
});
