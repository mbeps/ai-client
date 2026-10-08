import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryCard } from "@/components/memory/memory-card";
import type { Memory } from "@/types/memory/memory";

describe("MemoryCard", () => {
  const mockMemory: Memory = {
    id: "mem-1",
    userId: "user-1",
    content: "User loves Tailwind CSS and TypeScript",
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
  };

  it("renders memory content", () => {
    render(
      <MemoryCard
        memory={mockMemory}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByText("User loves Tailwind CSS and TypeScript"),
    ).toBeInTheDocument();
  });

  it("triggers onEdit when edit button is clicked", async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();

    render(
      <MemoryCard
        memory={mockMemory}
        onEdit={handleEdit}
        onDelete={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", { name: /edit/i });
    await user.click(editBtn);

    expect(handleEdit).toHaveBeenCalledWith(mockMemory);
  });

  it("triggers onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();

    render(
      <MemoryCard
        memory={mockMemory}
        onEdit={vi.fn()}
        onDelete={handleDelete}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledWith(mockMemory);
  });

  it("triggers onToggleSelect when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const handleToggleSelect = vi.fn();

    render(
      <MemoryCard
        memory={mockMemory}
        isSelected={false}
        onToggleSelect={handleToggleSelect}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /select memory/i });
    await user.click(checkbox);

    expect(handleToggleSelect).toHaveBeenCalledWith(mockMemory);
  });
});

