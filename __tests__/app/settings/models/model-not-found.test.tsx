import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelNotFound from "@/app/settings/models/[id]/not-found";
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

describe("ModelNotFound", () => {
  it("renders NotFoundPage with model not found props", () => {
    render(<ModelNotFound />);

    expect(screen.getByText("Model not found")).toBeInTheDocument();
    expect(
      screen.getByText("This AI model does not exist or you don't have access to it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to models" })).toHaveAttribute(
      "href",
      ROUTES.SETTINGS.MODELS.path,
    );
  });
});
