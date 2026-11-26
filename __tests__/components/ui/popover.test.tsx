import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverProvider,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

describe("Popover", () => {
  it("renders PopoverProvider, PopoverAnchor, PopoverHeader, PopoverTitle, and PopoverDescription", () => {
    render(
      <PopoverProvider>
        <Popover open>
          <PopoverAnchor>Anchor</PopoverAnchor>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Pop Title</PopoverTitle>
              <PopoverDescription>Pop Desc</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </PopoverProvider>,
    );

    expect(screen.getByText("Anchor")).toBeInTheDocument();
    expect(screen.getByText("Pop Title")).toBeInTheDocument();
    expect(screen.getByText("Pop Desc")).toBeInTheDocument();
  });
});
