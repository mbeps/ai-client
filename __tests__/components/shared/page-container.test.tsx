import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageContainer } from "@/components/shared/page-container";

describe("PageContainer", () => {
  it("renders children and default classes", () => {
    render(
      <PageContainer>
        <div>Content Inside</div>
      </PageContainer>,
    );

    expect(screen.getByText("Content Inside")).toBeInTheDocument();

    const container = screen.getByText("Content Inside").closest("[data-slot='page-container']");
    const content = screen.getByText("Content Inside").closest("[data-slot='page-container-content']");

    expect(container).toHaveClass("w-full", "h-full", "overflow-y-auto");
    expect(content).toHaveClass("max-w-7xl", "mx-auto", "p-4", "md:p-8");
  });

  it("applies narrow variant", () => {
    render(
      <PageContainer variant="narrow">
        <div>Narrow Content</div>
      </PageContainer>,
    );

    const content = screen.getByText("Narrow Content").closest("[data-slot='page-container-content']");
    expect(content).toHaveClass("max-w-5xl", "mx-auto");
  });

  it("applies full variant without max-width", () => {
    render(
      <PageContainer variant="full">
        <div>Full Width Content</div>
      </PageContainer>,
    );

    const content = screen.getByText("Full Width Content").closest("[data-slot='page-container-content']");
    expect(content).toHaveClass("w-full");
    expect(content).not.toHaveClass("max-w-7xl");
    expect(content).not.toHaveClass("max-w-5xl");
  });

  it("handles non-scrollable layouts for workbenches and split panels", () => {
    render(
      <PageContainer scrollable={false} padding="none">
        <div>Workbench Content</div>
      </PageContainer>,
    );

    const container = screen.getByText("Workbench Content").closest("[data-slot='page-container']");
    const content = screen.getByText("Workbench Content").closest("[data-slot='page-container-content']");

    expect(container).toHaveClass("h-full", "overflow-hidden", "flex", "flex-col");
    expect(container).not.toHaveClass("overflow-y-auto");
    expect(content).toHaveClass("flex", "flex-1", "min-h-0", "flex-col");
    expect(content).not.toHaveClass("p-4");
  });

  it("applies custom padding presets", () => {
    const { rerender } = render(
      <PageContainer padding="sm">
        <div>SM Padding</div>
      </PageContainer>,
    );
    let content = screen.getByText("SM Padding").closest("[data-slot='page-container-content']");
    expect(content).toHaveClass("p-3", "md:p-4");

    rerender(
      <PageContainer padding="lg">
        <div>LG Padding</div>
      </PageContainer>,
    );
    content = screen.getByText("LG Padding").closest("[data-slot='page-container-content']");
    expect(content).toHaveClass("p-6", "md:p-12");
  });

  it("merges custom className and containerClassName", () => {
    render(
      <PageContainer
        className="custom-content-class"
        containerClassName="custom-container-class"
        data-testid="page-container-root"
      >
        <div>Custom Classes</div>
      </PageContainer>,
    );

    const root = screen.getByTestId("page-container-root");
    expect(root).toHaveClass("custom-container-class");

    const content = screen.getByText("Custom Classes").closest("[data-slot='page-container-content']");
    expect(content).toHaveClass("custom-content-class");
  });
});

