import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { mockCreateMemory, mockUpdateMemory } = vi.hoisted(() => ({
  mockCreateMemory: vi.fn(),
  mockUpdateMemory: vi.fn(),
}));

vi.mock("@/actions/memories/create-memory", () => ({
  createMemory: (input: unknown) => mockCreateMemory(input),
}));

vi.mock("@/actions/memories/update-memory", () => ({
  updateMemory: (input: unknown) => mockUpdateMemory(input),
}));

import { MemoryDialog } from "@/components/memory/memory-dialog";
import type { Memory } from "@/types/memory/memory";

describe("MemoryDialog", () => {
  it("renders create form when memory is not provided", () => {
    render(
      <MemoryDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /add memory/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("submits new memory on create", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mockCreateMemory.mockResolvedValue({
      id: "mem-new",
      userId: "user-1",
      content: "Prefers Python",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    render(
      <MemoryDialog
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Prefers Python");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await user.click(saveBtn);

    expect(mockCreateMemory).toHaveBeenCalledWith({
      content: "Prefers Python",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders edit form and submits update when memory is provided", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const existingMemory: Memory = {
      id: "mem-1",
      userId: "user-1",
      content: "Prefers TypeScript",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUpdateMemory.mockResolvedValue({
      ...existingMemory,
      content: "Prefers TypeScript and Rust",
    });

    render(
      <MemoryDialog
        open={true}
        onOpenChange={onOpenChange}
        memory={existingMemory}
      />,
    );

    expect(screen.getByRole("heading", { name: /edit memory/i })).toBeInTheDocument();
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Prefers TypeScript");

    await user.clear(textarea);
    await user.type(textarea, "Prefers TypeScript and Rust");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await user.click(saveBtn);

    expect(mockUpdateMemory).toHaveBeenCalledWith({
      id: "mem-1",
      content: "Prefers TypeScript and Rust",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
