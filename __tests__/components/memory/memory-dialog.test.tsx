import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      ok: true,
      value: {
        id: "mem-new",
        userId: "user-1",
        content: "Prefers Python",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
      ok: true,
      value: {
        ...existingMemory,
        content: "Prefers TypeScript and Rust",
      },
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

  it("ignores whitespace-only submit, handles Cancel, action errors, and thrown errors", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<MemoryDialog open={true} onOpenChange={onOpenChange} />);

    // Cancel button
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Whitespace-only submit
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "   ");
    fireEvent.submit(textarea.closest("form")!);
    expect(mockCreateMemory).not.toHaveBeenCalled();

    // Create error with message and without message
    await user.clear(textarea);
    await user.type(textarea, "Valid memory");
    const form = textarea.closest("form")!;
    mockCreateMemory.mockResolvedValueOnce({ ok: false, error: { message: "Create failed" } });
    fireEvent.submit(form);
    await waitFor(() => expect(mockCreateMemory).toHaveBeenCalledTimes(1));

    mockCreateMemory.mockResolvedValueOnce({ ok: false, error: { message: "" } });
    fireEvent.submit(form);
    await waitFor(() => expect(mockCreateMemory).toHaveBeenCalledTimes(2));

    // Thrown Error and non-Error
    mockCreateMemory.mockRejectedValueOnce(new Error("Boom"));
    fireEvent.submit(form);
    await waitFor(() => expect(mockCreateMemory).toHaveBeenCalledTimes(3));

    mockCreateMemory.mockRejectedValueOnce("string error");
    fireEvent.submit(form);
    await waitFor(() => expect(mockCreateMemory).toHaveBeenCalledTimes(4));

    // Update error with message and without message
    const existing: Memory = {
      id: "mem-1",
      userId: "u1",
      content: "Old",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<MemoryDialog open={true} onOpenChange={onOpenChange} memory={existing} />);
    mockUpdateMemory.mockResolvedValueOnce({ ok: false, error: { message: "Update failed" } });
    const saveBtns = screen.getAllByRole("button", { name: /save/i });
    await user.click(saveBtns[saveBtns.length - 1]);
    await waitFor(() => expect(mockUpdateMemory).toHaveBeenCalledTimes(1));

    mockUpdateMemory.mockResolvedValueOnce({ ok: false, error: { message: "" } });
    await user.click(saveBtns[saveBtns.length - 1]);
    await waitFor(() => expect(mockUpdateMemory).toHaveBeenCalledTimes(2));
  });
});
