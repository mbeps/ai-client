import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { ROUTES } from "@/config/routes";

describe("NoModelsAlertBanner", () => {
  it("renders warning message and link to provider settings", () => {
    const message = "No chat models configured. Please set up a provider.";
    render(<NoModelsAlertBanner message={message} />);

    expect(screen.getByText(message)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go to settings/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", ROUTES.SETTINGS.PROVIDERS.path);
  });

  it("applies optional custom className", () => {
    const { container } = render(
      <NoModelsAlertBanner message="Warning" className="custom-banner-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-banner-class");
  });
});

