import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCardActions } from "@/components/shared/entity-card-actions";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("EntityCardActions", () => {
  it("renders open link and opens confirmation dialog on delete click", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <TooltipProvider>
        <EntityCardActions
          detailUrl="/settings/prompts/p1"
          openLabel="Open prompt"
          deleteLabel="Delete prompt"
          confirmTitle="Delete Prompt"
          confirmDescription="Are you sure?"
          onConfirmDelete={onConfirmDelete}
        />
      </TooltipProvider>,
    );

    const openLink = screen.getByRole("link", { name: "Open prompt" });
    expect(openLink).toHaveAttribute("href", "/settings/prompts/p1");

    await user.click(screen.getByRole("button", { name: "Delete prompt" }));
    expect(screen.getByText("Delete Prompt")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it("closes confirmation dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <EntityCardActions
          detailUrl="/settings/connectors/s1"
          openLabel="Open connector"
          deleteLabel="Uninstall tool"
          confirmTitle="Uninstall Tool"
          confirmDescription="Uninstall?"
          onConfirmDelete={vi.fn()}
          confirmLabel="Uninstall"
          confirmLoadingLabel="Uninstalling..."
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Uninstall tool" }));
    expect(screen.getByText("Uninstall Tool")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText("Uninstall Tool")).not.toBeInTheDocument();
  });
});
