import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import type { SortableResource } from "@/lib/utils";

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: { loadError: string | null }) => unknown) =>
    selector({ loadError: null }),
}));

interface TestItem extends SortableResource {
  name: string;
}

const mockItems: TestItem[] = [
  {
    id: "1",
    name: "Resource One",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "2",
    name: "Resource Two",
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  },
];

describe("ResourceListPage", () => {
  it("renders banner inside PageContainer when banner prop is provided", () => {
    render(
      <ResourceListPage
        banner={<div data-testid="test-banner">Warning: No Models Available</div>}
        icon={<span>Icon</span>}
        title="Test Resources"
        description="Manage test resources"
        items={mockItems}
        emptyStateMessage="No resources found"
        renderCard={(item) => <div key={item.id}>{item.name}</div>}
      />,
    );

    const banner = screen.getByTestId("test-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Warning: No Models Available");

    // Banner is inside page-container before page-header
    const pageContainer = banner.closest("[data-slot='page-container-content']");
    expect(pageContainer).toBeInTheDocument();
    expect(screen.getByText("Test Resources")).toBeInTheDocument();
  });

  it("does not render banner when banner prop is omitted", () => {
    render(
      <ResourceListPage
        icon={<span>Icon</span>}
        title="Test Resources"
        description="Manage test resources"
        items={mockItems}
        emptyStateMessage="No resources found"
        renderCard={(item) => <div key={item.id}>{item.name}</div>}
      />,
    );

    expect(screen.queryByTestId("test-banner")).not.toBeInTheDocument();
    expect(screen.getByText("Test Resources")).toBeInTheDocument();
  });

  it("renders 2 columns grid when columns prop is 2", () => {
    const { container } = render(
      <ResourceListPage
        icon={<span>Icon</span>}
        title="Test Resources"
        description="Manage test resources"
        items={mockItems}
        columns={2}
        emptyStateMessage="No resources found"
        renderCard={(item) => <div key={item.id}>{item.name}</div>}
      />,
    );

    const grid = container.querySelector(".md\\:grid-cols-2");
    expect(grid).toBeInTheDocument();
  });
});
