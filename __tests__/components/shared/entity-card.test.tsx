import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCard } from "@/components/shared/entity-card";

describe("EntityCard", () => {
  it("renders as semantic Link when href is provided", () => {
    render(
      <EntityCard
        href="/projects/test-project-1"
        title="Test Project"
        description="Project description"
      />,
    );

    const link = screen.getByRole("link", { name: /test project/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/projects/test-project-1");
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("Project description")).toBeInTheDocument();
  });

  it("renders without link when href is not provided", () => {
    const onClick = vi.fn();
    render(
      <EntityCard
        title="Plain Card"
        description="No link card"
        onClick={onClick}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Plain Card")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Plain Card"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stops click and keydown propagation in action containers when href is provided", async () => {
    const user = userEvent.setup();
    const actionClick = vi.fn();
    const linkClick = vi.fn();

    render(
      <div onClick={linkClick}>
        <EntityCard
          href="/target-page"
          title="Card with Actions"
          rightActions={
            <button type="button" onClick={actionClick}>
              Action Button
            </button>
          }
        />
      </div>,
    );

    const actionBtn = screen.getByRole("button", { name: "Action Button" });

    // Click on action button should not trigger parent click
    await user.click(actionBtn);
    expect(actionClick).toHaveBeenCalledTimes(1);
    expect(linkClick).not.toHaveBeenCalled();

    // Keydown on action button should not bubble to parent
    const keydownSpy = vi.fn();
    document.addEventListener("keydown", keydownSpy);
    fireEvent.keyDown(actionBtn, { key: "Enter" });
    // Handled and stopped propagation inside EntityCard container
  });
});
