import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConnectorError from "@/app/settings/connectors/[id]/error";
import { ROUTES } from "@/config/routes";

vi.mock("@/components/shared/error-page", () => ({
  ErrorPage: ({
    heading,
    fallbackDescription,
    linkHref,
    linkLabel,
  }: {
    heading: string;
    fallbackDescription: string;
    linkHref: string;
    linkLabel: string;
  }) => (
    <div data-testid="error-page">
      <span>{heading}</span>
      <span>{fallbackDescription}</span>
      <a href={linkHref}>{linkLabel}</a>
    </div>
  ),
}));

describe("ConnectorError", () => {
  it("renders ErrorPage with connector error props", () => {
    const error = new Error("Boom");
    const reset = vi.fn();

    render(<ConnectorError error={error} reset={reset} />);

    expect(screen.getByText("Failed to load connector")).toBeInTheDocument();
    expect(screen.getByText("This connector could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to connectors" })).toHaveAttribute(
      "href",
      ROUTES.CONNECTORS.path,
    );
  });
});
