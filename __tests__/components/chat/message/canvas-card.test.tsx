import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasCard } from "@/components/chat/message/canvas-card";
import type { ArtifactData } from "@/types/artifact/artifact-data";

describe("CanvasCard", () => {
  const mockArtifact: ArtifactData = {
    id: "art-1",
    type: "markdown",
    title: "Canvas Absence Notification",
    content: "# Absence Notification Content",
    messageId: "msg-1",
  };

  it("renders artifact title, type label, and Open button when closed", () => {
    render(
      <CanvasCard
        artifact={mockArtifact}
        isOpen={false}
        onToggle={vi.fn()}
        createdAt={new Date("2026-09-26T10:49:00Z")}
      />,
    );

    expect(screen.getByText("Canvas Absence Notification")).toBeInTheDocument();
    expect(screen.getByText(/Document/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^open$/i })).toBeInTheDocument();
  });

  it("renders Close button and active state when isOpen is true", () => {
    render(
      <CanvasCard artifact={mockArtifact} isOpen={true} onToggle={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: /^close$/i }),
    ).toBeInTheDocument();
  });

  it("triggers onToggle when card container is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <CanvasCard artifact={mockArtifact} isOpen={false} onToggle={onToggle} />,
    );

    const card = screen.getByRole("button", {
      name: /canvas card/i,
    });
    await user.click(card);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("triggers onToggle when Open/Close button is clicked and stops propagation", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <CanvasCard
        artifact={mockArtifact}
        isOpen={false}
        onToggle={onToggle}
      />,
    );

    const btn = screen.getByRole("button", { name: /^open$/i });
    await user.click(btn);
    // Should trigger exactly once (not duplicated by outer card handler)
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard Enter and Space activation", () => {
    const onToggle = vi.fn();
    render(
      <CanvasCard
        artifact={mockArtifact}
        isOpen={false}
        onToggle={onToggle}
      />,
    );

    const card = screen.getByRole("button", {
      name: /canvas card/i,
    });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("renders spreadsheet icon and label for spreadsheet artifacts", () => {
    const sheetArtifact: ArtifactData = {
      id: "art-sheet",
      type: "spreadsheet",
      title: "Q3 Revenue Projections",
      content: '{"sheets":[]}',
    };

    render(
      <CanvasCard
        artifact={sheetArtifact}
        isOpen={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("Q3 Revenue Projections")).toBeInTheDocument();
    expect(screen.getByText(/Spreadsheet/i)).toBeInTheDocument();
  });
});
