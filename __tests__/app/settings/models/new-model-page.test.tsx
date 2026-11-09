import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockUseProviders } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseProviders: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
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

vi.mock("@/actions/models/create-model", () => ({
  createModel: vi.fn().mockResolvedValue({ ok: true, value: { id: "m-new" } }),
}));

vi.mock("@/lib/providers/invalidate-provider-registry-cache", () => ({
  invalidateProviderRegistryCache: vi.fn(),
}));

import NewModelPage from "@/app/settings/models/new/page";

describe("NewModelPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviders.mockReturnValue({
      providers: [
        {
          id: "p1",
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1",
        },
      ],
      isLoading: false,
    });
  });

  it("renders page header and model editor form", () => {
    render(<NewModelPage />);

    expect(screen.getByText("Add Model")).toBeInTheDocument();
    expect(screen.getByText("Back to Models")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
  });

  it("shows loading skeleton when providers are loading", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: true,
    });

    render(<NewModelPage />);
    expect(screen.queryByText("Add Model")).not.toBeInTheDocument();
  });
});
