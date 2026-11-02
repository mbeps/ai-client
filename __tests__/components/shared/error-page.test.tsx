import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorPage } from "@/components/shared/error-page";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("ErrorPage", () => {
  it("renders heading and error message, logging Page error", () => {
    const error = new Error("Test explosion");
    const reset = vi.fn();

    render(
      <ErrorPage
        error={error}
        reset={reset}
        heading="Something went wrong"
        fallbackDescription="An unexpected error occurred."
        linkHref="/"
        linkLabel="Go home"
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
    expect(logger.error).toHaveBeenCalledWith("Page error", error);
    expect(logger.error).not.toHaveBeenCalledWith("Knowledgebase error", expect.anything());

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();
    fireEvent.click(tryAgainButton);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("handles ChunkLoadError by providing reload functionality", () => {
    const chunkError = new Error(
      "Failed to load chunk /_next/static/chunks/1gopbg2mqb8si.js from module 480609",
    );
    chunkError.name = "ChunkLoadError";
    const reset = vi.fn();

    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadMock },
    });

    render(
      <ErrorPage
        error={chunkError}
        reset={reset}
        heading="Something went wrong"
        fallbackDescription="An unexpected error occurred."
        linkHref="/"
        linkLabel="Go home"
      />,
    );

    const reloadButton = screen.getByRole("button", { name: /reload page/i });
    expect(reloadButton).toBeInTheDocument();
    fireEvent.click(reloadButton);
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });
});

