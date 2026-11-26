import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

describe("Sheet", () => {
  it("renders SheetTrigger, SheetClose, and all side variants", () => {
    const sides = ["left", "top", "bottom"] as const;
    for (const side of sides) {
      const { unmount } = render(
        <Sheet open>
          <SheetTrigger>Open {side}</SheetTrigger>
          <SheetContent side={side}>
            <SheetTitle>Title {side}</SheetTitle>
            <SheetClose>Close {side}</SheetClose>
          </SheetContent>
        </Sheet>,
      );
      expect(screen.getByText(`Title ${side}`)).toBeInTheDocument();
      expect(screen.getByText(`Close ${side}`)).toBeInTheDocument();
      unmount();
    }
  });
});
