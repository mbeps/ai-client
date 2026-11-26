import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProviderNotFound from "@/app/settings/providers/[id]/not-found";
import { ROUTES } from "@/config/routes";

vi.mock("@/components/shared/not-found-page", () => ({
  NotFoundPage: ({
    title,
    description,
    linkHref,
    linkLabel,
  }: {
    title: string;
    description: string;
    linkHref: string;
    linkLabel: string;
  }) => (
    <div data-testid="not-found-page">
      <span>{title}</span>
      <span>{description}</span>
      <a href={linkHref}>{linkLabel}</a>
    </div>
  ),
}));

describe("ProviderNotFound", () => {
  it("renders NotFoundPage with provider not found props", () => {
    render(<ProviderNotFound />);

    expect(screen.getByText("Provider not found")).toBeInTheDocument();
    expect(
      screen.getByText("This provider does not exist or you don't have access to it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to providers" })).toHaveAttribute(
      "href",
      ROUTES.SETTINGS.PROVIDERS.path,
    );
  });
});
