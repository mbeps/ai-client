import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelCapabilityBanner } from "@/components/chat/input/model-capability-banner";

describe("ModelCapabilityBanner", () => {
  it("returns null when hasNoModels is false", () => {
    const { container } = render(<ModelCapabilityBanner hasNoModels={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders warning banner and Configure link when hasNoModels is true", () => {
    render(<ModelCapabilityBanner hasNoModels={true} />);
    expect(screen.getByText("All providers are disabled or no models found")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Configure/i })).toBeTruthy();
  });
});
