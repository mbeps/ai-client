import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockNextThemesProvider = vi.fn(
  ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-themes-provider">{children}</div>
  ),
);

vi.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) =>
    mockNextThemesProvider(props as { children: React.ReactNode }),
}));

import { ThemeProvider } from "@/components/theme-provider";

describe("ThemeProvider", () => {
  it("renders children and forwards props to NextThemesProvider", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <span>App Content</span>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
    expect(screen.getByText("App Content")).toBeInTheDocument();
    expect(mockNextThemesProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: "class",
        defaultTheme: "system",
        enableSystem: true,
      }),
    );
  });
});
