import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderCard } from "@/components/settings/providers/provider-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

function makeProvider(overrides: Partial<AiProviderRow> = {}): AiProviderRow {
  return {
    id: "p-1",
    userId: "u-1",
    type: "openai-compatible",
    name: "My Provider",
    baseUrl: "https://api.example.com/v1",
    apiKey: "[REDACTED]",
    requiresKey: true,
    isEnabled: true,
    headers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function renderCard(provider: AiProviderRow) {
  return render(
    <TooltipProvider>
      <ProviderCard
        provider={provider}
        isBusy={false}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onTest={vi.fn()}
        onSync={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe("ProviderCard", () => {
  it("renders provider type badge and BETA badge for community providers", () => {
    renderCard(makeProvider({ type: "openrouter", name: "OpenRouter Prod" }));

    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("disables Sync Models button when provider does not support sync", () => {
    renderCard(makeProvider({ type: "perplexity", name: "Perplexity" }));

    const syncButton = screen.getByRole("button", { name: /Sync Models/i });
    expect(syncButton).toBeDisabled();
  });

  it("enables Sync Models button when provider supports sync", () => {
    renderCard(makeProvider({ type: "openai", name: "OpenAI" }));

    const syncButton = screen.getByRole("button", { name: /Sync Models/i });
    expect(syncButton).not.toBeDisabled();
  });
});
