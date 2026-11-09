import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPush,
  mockNotFound,
  mockUseProviders,
  mockUseUserModels,
  mockDeleteModel,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockNotFound: vi.fn(),
  mockUseProviders: vi.fn(),
  mockUseUserModels: vi.fn(),
  mockDeleteModel: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "m1" }),
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  notFound: () => mockNotFound(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => ["details", vi.fn()]),
}));

vi.mock("@/hooks/use-providers", () => ({
  useProviders: () => mockUseProviders(),
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => mockUseUserModels(),
}));

vi.mock("@/actions/models/delete-model", () => ({
  deleteModel: (id: string) => mockDeleteModel(id),
}));

vi.mock("@/actions/models/update-model", () => ({
  updateModels: vi.fn().mockResolvedValue({ ok: true, value: {} }),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: vi.fn(),
}));

import ModelDetailPage from "@/app/settings/models/[id]/page";

describe("ModelDetailPage", () => {
  const dummyModel = {
    id: "m1",
    userId: "u1",
    providerId: "p1",
    modelId: "openai/gpt-4o",
    label: "GPT-4o",
    modelType: "chat" as const,
    contextWindow: 128000,
    embeddingDimensions: null,
    capTools: true,
    capVision: true,
    capReasoning: false,
    capStructuredOutput: true,
    reasoningEffortFormat: "none" as const,
    modelOptions: null,
    isEnabled: true,
    providerName: "OpenRouter",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviders.mockReturnValue({
      providers: [{ id: "p1", name: "OpenRouter" }],
      isLoading: false,
    });
    mockUseUserModels.mockReturnValue({
      rawModels: [dummyModel],
      isLoading: false,
      refresh: vi.fn(),
    });
    mockDeleteModel.mockResolvedValue({ ok: true, value: {} });
  });

  it("renders model details page and breadcrumb", () => {
    render(<ModelDetailPage />);

    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("Back to Models")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
  });

  it("calls notFound when model is not found in rawModels", () => {
    mockUseUserModels.mockReturnValue({
      rawModels: [],
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ModelDetailPage />);
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows loading skeleton when data is fetching", () => {
    mockUseUserModels.mockReturnValue({
      rawModels: [],
      isLoading: true,
      refresh: vi.fn(),
    });

    render(<ModelDetailPage />);
    expect(screen.queryByText("Back to Models")).not.toBeInTheDocument();
  });
});
