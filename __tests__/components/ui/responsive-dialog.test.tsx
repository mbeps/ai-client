import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";

const mockUseIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

describe("ResponsiveDialog", () => {
  it("renders Dialog on desktop and Drawer on mobile", () => {
    mockUseIsMobile.mockReturnValue(false);
    const { unmount } = render(
      <ResponsiveDialog open>
        <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Desktop Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Desktop Desc</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose>Close</ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Desktop Title")).toBeInTheDocument();
    unmount();

    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mobile Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Mobile Desc</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose>Close</ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Mobile Title")).toBeInTheDocument();
  });

  it("renders Drawer variants on mobile", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <ResponsiveDialog open={true} onOpenChange={vi.fn()}>
          <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Mobile Dialog</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>Mobile Desc</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogFooter>
              <ResponsiveDialogClose>Close</ResponsiveDialogClose>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>,
      );
      expect(await screen.findByText("Mobile Dialog")).toBeInTheDocument();
      expect(screen.getByText("Mobile Desc")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
});
