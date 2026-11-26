import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelCapabilityBadges } from "@/components/settings/providers/model-table/model-capability-badges";
import { ModelContextCell } from "@/components/settings/providers/model-table/model-context-cell";
import { ModelTableBulkActions } from "@/components/settings/providers/model-table/model-table-bulk-actions";
import { ModelTableFilterToolbar } from "@/components/settings/providers/model-table/model-table-filter-toolbar";
import { ModelTableModals } from "@/components/settings/providers/model-table/model-table-modals";
import { ModelTableRow } from "@/components/settings/providers/model-table/model-table-row";
import { matchesModelFilters } from "@/components/settings/providers/model-table/model-table-utils";
import {
  useModelTableActions,
  useModelTableFilters,
  useModelTableModals,
} from "@/components/settings/providers/model-table/use-model-table-actions";
import type { AiModelRow } from "@/types/provider/ai-model-row";

const {
  mockDeleteModel,
  mockUpdateModels,
  mockInvalidateCache,
  mockToastError,
  mockToastPromise,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockDeleteModel: vi.fn(),
  mockUpdateModels: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockToastError: vi.fn(),
  mockToastPromise: vi.fn((promise: Promise<unknown>) => promise),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/actions/models/delete-model", () => ({
  deleteModel: mockDeleteModel,
}));

vi.mock("@/actions/models/update-model", () => ({
  updateModels: mockUpdateModels,
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: mockInvalidateCache,
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ error: mockLoggerError }),
  logger: { error: mockLoggerError },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    promise: mockToastPromise,
  },
}));

const baseModel: AiModelRow = {
  id: "m1",
  providerId: "p1",
  userId: "u1",
  modelId: "gpt-4o",
  label: "GPT-4o",
  displayName: "GPT-4o",
  modelType: "chat",
  contextWindow: 128000,
  maxOutputTokens: 4096,
  embeddingDimensions: null,
  capTools: true,
  capVision: true,
  capReasoning: false,
  capStructuredOutput: true,
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("model-table-utils", () => {
  it("matchesModelFilters covers provider, type, status, and search filters", () => {
    const allFilters = {
      search: "",
      providerFilter: "all",
      statusFilter: "all",
      typeFilter: "all" as const,
    };

    expect(matchesModelFilters(baseModel, allFilters, "OpenAI")).toBe(true);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, providerFilter: "p2" }, "OpenAI"),
    ).toBe(false);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, typeFilter: "both" }, "OpenAI"),
    ).toBe(false);
    expect(
      matchesModelFilters(
        { ...baseModel, modelType: "both" },
        { ...allFilters, typeFilter: "both" },
        "OpenAI",
      ),
    ).toBe(true);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, typeFilter: "embedding" }, "OpenAI"),
    ).toBe(false);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, statusFilter: "enabled" }, "OpenAI"),
    ).toBe(true);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, statusFilter: "disabled" }, "OpenAI"),
    ).toBe(false);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, search: "openai" }, "OpenAI"),
    ).toBe(true);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, search: "gpt-4o" }, "OpenAI"),
    ).toBe(true);
    expect(
      matchesModelFilters(baseModel, { ...allFilters, search: "nonexistent" }, "OpenAI"),
    ).toBe(false);
  });
});

describe("ModelCapabilityBadges & ModelContextCell", () => {
  it("renders 'none' when model has no capabilities", () => {
    render(
      <ModelCapabilityBadges
        model={{
          ...baseModel,
          capTools: false,
          capVision: false,
          capReasoning: false,
          capStructuredOutput: false,
        }}
      />,
    );
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("renders embedding dimensions or dash for embedding/both models", () => {
    const { rerender } = render(
      <ModelContextCell model={{ ...baseModel, modelType: "embedding", embeddingDimensions: null }} />,
    );
    expect(screen.getByText("- dims")).toBeInTheDocument();

    rerender(
      <ModelContextCell model={{ ...baseModel, modelType: "both", embeddingDimensions: 1536 }} />,
    );
    expect(screen.getByText("1536 dims")).toBeInTheDocument();
  });

  it("renders ModelTableFilterToolbar and handles search and type filter changes", () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();
    render(
      <ModelTableFilterToolbar
        search=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        providerFilter="all"
        onProviderFilterChange={vi.fn()}
        typeFilter="all"
        onTypeFilterChange={onTypeFilterChange}
        providers={[{ id: "p1", name: "OpenAI" } as never]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search models..."), {
      target: { value: "gpt" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("gpt");
  });

  it("renders ModelTableRow for embedding and both types and triggers row actions", () => {
    const onToggleEnabled = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <table>
        <tbody>
          <ModelTableRow
            model={{ ...baseModel, modelType: "embedding" }}
            providerName="OpenAI"
            isSelected={false}
            isBusy={false}
            onToggleSelect={vi.fn()}
            onToggleEnabled={onToggleEnabled}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disable model" }));
    expect(onToggleEnabled).toHaveBeenCalledWith({ ...baseModel, modelType: "embedding" }, false);

    fireEvent.click(screen.getByRole("link", { name: "Edit Model" }));
    expect(onEdit).toHaveBeenCalled();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalled();

    rerender(
      <table>
        <tbody>
          <ModelTableRow
            model={{ ...baseModel, modelType: "both", isEnabled: false }}
            providerName="OpenAI"
            isSelected={true}
            isBusy={false}
            onToggleSelect={vi.fn()}
            onToggleEnabled={onToggleEnabled}
            onDelete={onDelete}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Edit Model" }));
  });
});

describe("ModelTableBulkActions & ModelTableModals", () => {
  it("renders bulk actions in idle and busy states and triggers callbacks", () => {
    const onBulkAction = vi.fn();
    const { rerender } = render(
      <ModelTableBulkActions isBusy={false} onBulkAction={onBulkAction} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enable/i }));
    fireEvent.click(screen.getByRole("button", { name: /disable/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onBulkAction).toHaveBeenCalledWith("enable");
    expect(onBulkAction).toHaveBeenCalledWith("disable");
    expect(onBulkAction).toHaveBeenCalledWith("delete");

    rerender(<ModelTableBulkActions isBusy={true} onBulkAction={onBulkAction} />);
    expect(screen.getByRole("button", { name: /enable/i })).toBeDisabled();
  });

  it("renders ModelTableModals with label, modelId, and id fallbacks", () => {
    const baseProps = {
      onCloseDeleteModel: vi.fn(),
      isModelDeleteLoading: false,
      onConfirmDeleteModel: vi.fn().mockResolvedValue(undefined),
      isBulkDeleteConfirmOpen: false,
      onCloseBulkDelete: vi.fn(),
      selectedCount: 2,
      isBulkDeleteLoading: false,
      onConfirmBulkDelete: vi.fn().mockResolvedValue(undefined),
    };

    const { rerender } = render(
      <ModelTableModals {...baseProps} modelToDelete={baseModel} />,
    );
    expect(screen.getByText(/GPT-4o/)).toBeInTheDocument();

    rerender(
      <ModelTableModals
        {...baseProps}
        modelToDelete={{ ...baseModel, label: undefined as unknown as string }}
      />,
    );
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument();

    rerender(
      <ModelTableModals
        {...baseProps}
        modelToDelete={{
          ...baseModel,
          label: undefined as unknown as string,
          modelId: undefined as unknown as string,
        }}
      />,
    );
    expect(screen.getByText(/m1/)).toBeInTheDocument();
  });
});

describe("useModelTableFilters, useModelTableModals, useModelTableActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes filters and modals hooks", () => {
    const { result: filters, unmount: u1 } = renderHook(() => useModelTableFilters());
    expect(filters.current.search).toBe("");
    expect(filters.current.providerFilter).toBe("all");
    u1();

    const { result: modals, unmount: u2 } = renderHook(() => useModelTableModals());
    expect(modals.current.modelToDelete).toBeNull();
    expect(modals.current.isBulkDeleteConfirmOpen).toBe(false);
    u2();
  });

  it("handles runModelAction success, ok:false, Error throw, and non-Error throw", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const setSelectedIds = vi.fn();
    const setIsBulkDeleteConfirmOpen = vi.fn();

    const { result, unmount } = renderHook(() =>
      useModelTableActions(
        onRefresh,
        new Set(["m1"]),
        setSelectedIds,
        setIsBulkDeleteConfirmOpen,
      ),
    );

    await act(async () => {
      await result.current.runModelAction("m1", async () => ({ ok: true }));
    });
    expect(mockInvalidateCache).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();

    await act(async () => {
      await result.current.runModelAction("m1", async () => ({
        ok: false,
        error: { message: "Bad model" },
      }));
    });
    expect(mockToastError).toHaveBeenCalledWith("Bad model");

    await act(async () => {
      await result.current.runModelAction("m1", async () => ({
        ok: false,
        error: { message: "" },
      }));
    });
    expect(mockToastError).toHaveBeenCalledWith("Model action failed");

    await act(async () => {
      await result.current.runModelAction("m1", async () => {
        throw new Error("Boom");
      });
    });
    expect(mockToastError).toHaveBeenCalledWith("Boom");

    await act(async () => {
      await result.current.runModelAction("m1", async () => {
        throw "string-err";
      });
    });
    expect(mockToastError).toHaveBeenCalledWith("Model action failed");

    unmount();
  });

  it("handles handleBulkAction and executeBulkDelete for empty, delete, enable, disable, and errors", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const setSelectedIds = vi.fn();
    const setIsBulkDeleteConfirmOpen = vi.fn();

    const { result: emptyResult, unmount: uEmpty } = renderHook(() =>
      useModelTableActions(
        onRefresh,
        new Set(),
        setSelectedIds,
        setIsBulkDeleteConfirmOpen,
      ),
    );
    await act(async () => {
      await emptyResult.current.handleBulkAction("enable");
      await emptyResult.current.executeBulkDelete();
    });
    expect(mockUpdateModels).not.toHaveBeenCalled();
    expect(mockDeleteModel).not.toHaveBeenCalled();
    uEmpty();

    const { result, unmount } = renderHook(() =>
      useModelTableActions(
        onRefresh,
        new Set(["m1", "m2"]),
        setSelectedIds,
        setIsBulkDeleteConfirmOpen,
      ),
    );

    await act(async () => {
      await result.current.handleBulkAction("delete");
    });
    expect(setIsBulkDeleteConfirmOpen).toHaveBeenCalledWith(true);

    mockUpdateModels.mockResolvedValueOnce({ ok: true, value: undefined });
    await act(async () => {
      await result.current.handleBulkAction("enable");
    });
    expect(mockUpdateModels).toHaveBeenCalledWith(["m1", "m2"], { isEnabled: true });

    mockUpdateModels.mockResolvedValueOnce({
      ok: false,
      error: { message: "Update failed" },
    });
    await act(async () => {
      await result.current.handleBulkAction("disable");
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Bulk action failed", expect.any(Error));

    mockDeleteModel.mockResolvedValueOnce({ ok: true, value: undefined });
    await act(async () => {
      await result.current.executeBulkDelete();
    });
    expect(mockDeleteModel).toHaveBeenCalledWith(["m1", "m2"]);
    expect(setIsBulkDeleteConfirmOpen).toHaveBeenCalledWith(false);

    mockDeleteModel.mockResolvedValueOnce({
      ok: false,
      error: { message: "Delete failed" },
    });
    await act(async () => {
      await result.current.executeBulkDelete();
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Bulk delete failed", expect.any(Error));

    unmount();
  });
});
