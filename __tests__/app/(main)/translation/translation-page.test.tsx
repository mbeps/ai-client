import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useTranslationWorkflowMock } = vi.hoisted(() => ({
  useTranslationWorkflowMock: vi.fn(),
}));

vi.mock("@/components/workflows/translation/use-translation-workflow", () => ({
  useTranslationWorkflow: useTranslationWorkflowMock,
}));

vi.mock("@/components/shared/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ReasoningEffortSelector: () => <div data-testid="reasoning-effort-selector" />,
}));

vi.mock("@/components/shared/no-models-alert-banner", () => ({
  NoModelsAlertBanner: ({ message }: { message: string }) => (
    <div data-testid="no-models-banner">{message}</div>
  ),
}));

vi.mock("@/components/workflows/translation/language-pair-toolbar", () => ({
  LanguagePairToolbar: () => <div data-testid="language-pair-toolbar" />,
}));

vi.mock("@/components/workflows/translation/translation-source-pane", () => ({
  TranslationSourcePane: () => <div data-testid="translation-source-pane" />,
}));

vi.mock("@/components/workflows/translation/translation-target-pane", () => ({
  TranslationTargetPane: () => <div data-testid="translation-target-pane" />,
}));

import TranslationWorkflowPage from "@/app/(main)/translation/page";

describe("TranslationWorkflowPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders idle state without reasoning effort or missing-models banner", () => {
    useTranslationWorkflowMock.mockReturnValue({
      modelId: "m1",
      setModelId: vi.fn(),
      supportsReasoningEffort: false,
      reasoningEffort: "medium",
      setReasoningEffort: vi.fn(),
      isLoading: false,
      hasNoModels: false,
      sourceLang: "English",
      targetLang: "Spanish",
      sourceLangValue: "en",
      setSourceLangValue: vi.fn(),
      setTargetLangValue: vi.fn(),
      swapLanguages: vi.fn(),
      sourceText: "Hello",
      setSourceText: vi.fn(),
      attachment: null,
      removeAttachment: vi.fn(),
      isVisionModel: false,
      isExtracting: false,
      fileInputRef: { current: null },
      handleFileSelect: vi.fn(),
      handleReset: vi.fn(),
      translatedText: "",
      isCopied: false,
      handleCopy: vi.fn(),
      handleTranslate: vi.fn(),
      canTranslate: true,
    });

    render(<TranslationWorkflowPage />);
    expect(screen.queryByTestId("reasoning-effort-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("no-models-banner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translate" })).toBeEnabled();
  });

  it("renders loading state with reasoning effort and missing-models banner", () => {
    useTranslationWorkflowMock.mockReturnValue({
      modelId: "",
      setModelId: vi.fn(),
      supportsReasoningEffort: true,
      reasoningEffort: "high",
      setReasoningEffort: vi.fn(),
      isLoading: true,
      hasNoModels: true,
      sourceLang: "English",
      targetLang: "French",
      sourceLangValue: "en",
      setSourceLangValue: vi.fn(),
      setTargetLangValue: vi.fn(),
      swapLanguages: vi.fn(),
      sourceText: "",
      setSourceText: vi.fn(),
      attachment: null,
      removeAttachment: vi.fn(),
      isVisionModel: true,
      isExtracting: false,
      fileInputRef: { current: null },
      handleFileSelect: vi.fn(),
      handleReset: vi.fn(),
      translatedText: "Bonjour",
      isCopied: true,
      handleCopy: vi.fn(),
      handleTranslate: vi.fn(),
      canTranslate: false,
    });

    render(<TranslationWorkflowPage />);
    expect(screen.getByTestId("reasoning-effort-selector")).toBeInTheDocument();
    expect(screen.getByTestId("no-models-banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translating..." })).toBeDisabled();
  });
});
