import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CommandDialog, CommandItem, CommandList } from "@/components/ui/command";

describe("CommandDialog", () => {
  beforeEach(() => {
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });
  it("renders nothing in the DOM when closed (open=false)", () => {
    const { container } = render(
      <CommandDialog open={false}>
        <CommandList>
          <CommandItem>Option 1</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Command Palette")).not.toBeInTheDocument();
    expect(screen.queryByText("Search for a command to run...")).not.toBeInTheDocument();
    expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    expect(document.querySelector(".sr-only")).toBeNull();
  });

  it("renders DialogHeader with title, description, and content when open (open=true)", () => {
    render(
      <CommandDialog
        open={true}
        title="Custom Title"
        description="Custom Description"
      >
        <CommandList>
          <CommandItem>Command Action</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const title = screen.getByText("Custom Title");
    const description = screen.getByText("Custom Description");
    const item = screen.getByText("Command Action");

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(item).toBeInTheDocument();

    // Verify DialogHeader is inside the dialog
    expect(dialog).toContainElement(title);
    expect(dialog).toContainElement(description);
    expect(dialog).toContainElement(item);
  });
});
