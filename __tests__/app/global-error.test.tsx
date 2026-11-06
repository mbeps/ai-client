import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

describe("GlobalError boundary", () => {
  it("renders global error document with heading and reset action", () => {
    const reset = vi.fn();
    const error = new Error("Catastrophic layout crash") as Error & {
      digest?: string;
    };
    error.digest = "err-12345";

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/err-12345/)).toBeInTheDocument();
  });
});
