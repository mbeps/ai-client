import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveDetails } from "@/components/ui/responsive-details";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockUseIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

describe("ResponsiveDetails", () => {
  it("renders trigger element without error", () => {
    render(
      <TooltipProvider>
        <ResponsiveDetails
          trigger={<button type="button">Open Details</button>}
          title="Details Dialog"
        >
          <p>Details Content</p>
        </ResponsiveDetails>
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Open Details" })).toBeInTheDocument();
  });

  it("renders with tooltip without throwing", () => {
    render(
      <TooltipProvider>
        <ResponsiveDetails
          trigger={<button type="button">Pill Trigger</button>}
          tooltip="Session context tooltip"
          title="Session Info"
        >
          <p>Session Body</p>
        </ResponsiveDetails>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Pill Trigger" });
    expect(button).toBeInTheDocument();
  });

  it("opens dialog on click", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <ResponsiveDetails
          trigger={<button type="button">Click Me</button>}
          tooltip="Click tooltip"
          title="Modal Title"
        >
          <p>Modal body content</p>
        </ResponsiveDetails>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Click Me" });
    await user.click(button);

    expect(await screen.findByText("Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Modal body content")).toBeInTheDocument();
  });

  it("renders Drawer on mobile with description", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <ResponsiveDetails
          trigger={<button type="button">Mobile Trigger</button>}
          title="Mobile Title"
          description="Mobile Desc"
        >
          <p>Mobile Body</p>
        </ResponsiveDetails>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Mobile Trigger" }));
    expect(await screen.findByText("Mobile Title")).toBeInTheDocument();
    expect(screen.getByText("Mobile Desc")).toBeInTheDocument();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("renders Drawer without description on mobile", async () => {
    const user = userEvent.setup();
    mockUseIsMobile.mockReturnValue(true);

    render(
      <ResponsiveDetails
        trigger={<button>No Desc Trigger</button>}
        title="No Desc Title"
      >
        <div>Body</div>
      </ResponsiveDetails>,
    );

    await user.click(screen.getByRole("button", { name: "No Desc Trigger" }));
    expect(await screen.findByText("No Desc Title")).toBeInTheDocument();
    mockUseIsMobile.mockReturnValue(false);
  });
});

