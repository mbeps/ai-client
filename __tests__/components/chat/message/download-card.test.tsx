import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DownloadCard } from "@/components/chat/message/download-card";
import * as downloadUtil from "@/lib/utils/download-file";
import type { DownloadItem } from "@/types/download/download-item";

describe("DownloadCard", () => {
  const mockItem: DownloadItem = {
    id: "dl-1",
    title: "Q3_Revenue_Model.xlsx",
    url: "https://storage.local/bucket/Q3_Revenue_Model.xlsx",
    type: "spreadsheet",
    extension: "xlsx",
    size: 20480,
    source: "Excel MCP",
  };

  it("renders item title, type label, formatted size, and Download button", () => {
    render(
      <DownloadCard
        item={mockItem}
        createdAt={new Date("2026-10-07T10:00:00Z")}
      />,
    );

    expect(screen.getByText("Q3_Revenue_Model.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Spreadsheet")).toBeInTheDocument();
    expect(screen.getByText("20.0 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeInTheDocument();
  });

  it("triggers downloadFile when card container is clicked", async () => {
    const downloadSpy = vi
      .spyOn(downloadUtil, "downloadFile")
      .mockResolvedValue();
    const user = userEvent.setup();

    render(<DownloadCard item={mockItem} />);

    const card = screen.getByRole("button", {
      name: /download q3_revenue_model\.xlsx/i,
    });
    await user.click(card);

    expect(downloadSpy).toHaveBeenCalledWith(
      "https://storage.local/bucket/Q3_Revenue_Model.xlsx",
      "Q3_Revenue_Model.xlsx",
    );
    downloadSpy.mockRestore();
  });

  it("triggers downloadFile when button is clicked and stops propagation", async () => {
    const downloadSpy = vi
      .spyOn(downloadUtil, "downloadFile")
      .mockResolvedValue();
    const user = userEvent.setup();

    render(<DownloadCard item={mockItem} />);

    const btn = screen.getByRole("button", { name: /^download$/i });
    await user.click(btn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    downloadSpy.mockRestore();
  });

  it("supports keyboard Enter and Space activation", async () => {
    const downloadSpy = vi
      .spyOn(downloadUtil, "downloadFile")
      .mockResolvedValue();

    render(<DownloadCard item={mockItem} />);

    const card = screen.getByRole("button", {
      name: /download q3_revenue_model\.xlsx/i,
    });

    fireEvent.keyDown(card, { key: "Enter" });
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(card, { key: " " });
    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(2);
    });

    downloadSpy.mockRestore();
  });
});

