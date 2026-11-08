import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelTableFilterToolbar } from "@/components/settings/providers/model-table/model-table-filter-toolbar";
import { ModelTableRow } from "@/components/settings/providers/model-table/model-table-row";
import { Table, TableBody } from "@/components/ui/table";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

describe("ModelTableFilterToolbar", () => {
  const dummyProviders: AiProviderRow[] = [
    {
      id: "p1",
      userId: "u1",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      requiresKey: true,
      isEnabled: true,
      customHeaders: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("renders search input with placeholder and dropdown triggers", () => {
    render(
      <ModelTableFilterToolbar
        search=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        providerFilter="all"
        onProviderFilterChange={vi.fn()}
        typeFilter="all"
        onTypeFilterChange={vi.fn()}
        providers={dummyProviders}
      />,
    );

    expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();
    expect(screen.getByText("Everything")).toBeInTheDocument();
    expect(screen.getByText("All providers")).toBeInTheDocument();
    expect(screen.getByText("All types")).toBeInTheDocument();
  });

  it("displays capitalized types dropdown options when opened", async () => {
    const user = userEvent.setup();
    render(
      <ModelTableFilterToolbar
        search=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        providerFilter="all"
        onProviderFilterChange={vi.fn()}
        typeFilter="all"
        onTypeFilterChange={vi.fn()}
        providers={dummyProviders}
      />,
    );

    const typeTrigger = screen.getByRole("combobox", { name: /type filter/i });
    await user.click(typeTrigger);

    expect(screen.getByRole("option", { name: /chat/i })).toHaveTextContent("Chat");
    expect(screen.getByRole("option", { name: /embedding/i })).toHaveTextContent("Embedding");
    expect(screen.getByRole("option", { name: /both/i })).toHaveTextContent("Both");
  });
});

describe("ModelTableRow", () => {
  const dummyModel: AiModelRow = {
    id: "m1",
    userId: "u1",
    providerId: "p1",
    modelId: "anthropic/claude-3-7-sonnet-20250219-thinking-preview:extended",
    label: "Claude 3.7 Sonnet Extended Thinking",
    modelType: "chat",
    contextWindow: 200000,
    embeddingDimensions: null,
    capTools: true,
    capVision: true,
    capReasoning: true,
    capStructuredOutput: true,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders model cell with width limits, truncate, and titles", () => {
    render(
      <Table>
        <TableBody>
          <ModelTableRow
            model={dummyModel}
            providerName="OpenRouter"
            isSelected={false}
            isBusy={false}
            onToggleSelect={vi.fn()}
            onToggleEnabled={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </TableBody>
      </Table>,
    );

    const labelElement = screen.getByText("Claude 3.7 Sonnet Extended Thinking");
    expect(labelElement).toHaveAttribute("title", "Claude 3.7 Sonnet Extended Thinking");
    expect(labelElement).toHaveClass("truncate");

    const idElement = screen.getByText("anthropic/claude-3-7-sonnet-20250219-thinking-preview:extended");
    expect(idElement).toHaveAttribute("title", "anthropic/claude-3-7-sonnet-20250219-thinking-preview:extended");
    expect(idElement).toHaveClass("truncate");
    expect(idElement).toHaveClass("font-mono");

    const modelCell = labelElement.closest("td");
    expect(modelCell).toHaveClass("max-w-[260px]");
    expect(modelCell).toHaveClass("md:max-w-[320px]");

    const typeBadge = screen.getByText("chat");
    expect(typeBadge).toHaveClass("capitalize");
    expect(typeBadge.querySelector("svg")).toBeInTheDocument();

    // Check capability badges
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Vision")).toBeInTheDocument();
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("Structured")).toBeInTheDocument();
  });
});
