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

  it("renders all file types, size formats, invalid date, escape key, and download error", async () => {
    const downloadSpy = vi
      .spyOn(downloadUtil, "downloadFile")
      .mockRejectedValueOnce(new Error("Network error"));

    const types = ["document", "archive", "code", "image", "audio", "video", "other"] as const;
    const { rerender } = render(
      <DownloadCard
        item={{ id: "d1", title: "File", url: "/f", type: "document", size: 500 } as any}
        createdAt={"not-a-date" as any}
      />,
    );
    expect(screen.getByText(/500 B/)).toBeInTheDocument();

    const card = screen.getByRole("button", { name: /^download$/i });
    fireEvent.keyDown(card, { key: "Escape" });
    fireEvent.click(card);
    await waitFor(() => expect(downloadSpy).toHaveBeenCalledTimes(1));

    rerender(
      <DownloadCard
        item={{ id: "d2", title: "", url: "/f2", type: "archive", size: 2048 } as any}
      />,
    );
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();

    rerender(
      <DownloadCard
        item={{ id: "d3", title: "Big", url: "/f3", type: "code", size: 2 * 1024 * 1024 } as any}
      />,
    );
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();

    for (const t of types) {
      rerender(
        <DownloadCard
          item={{ id: `d-${t}`, title: t, url: "/f", type: t } as any}
        />,
      );
    }

    downloadSpy.mockRestore();
  });

  it("ignores duplicate clicks while downloading, handles DateTimeFormat error, and shows item.source without sizeLabel", async () => {
    let resolveDl!: () => void;
    const downloadSpy = vi
      .spyOn(downloadUtil, "downloadFile")
      .mockImplementation(() => new Promise<void>((r) => { resolveDl = r; }));

    const dtfSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementationOnce(() => {
      throw new Error("dtf fail");
    });

    render(
      <DownloadCard
        item={{
          id: "d-src",
          title: "Report",
          url: "/r.pdf",
          type: "pdf",
          source: "S3",
        } as any}
        createdAt={new Date()}
      />,
    );

    expect(screen.getByText("S3")).toBeInTheDocument();
    const btn = screen.getAllByRole("button", { name: /download/i })[0];
    fireEvent.click(btn);
    fireEvent.click(btn); // second click while isDownloading is true
    expect(downloadSpy).toHaveBeenCalledTimes(1);

    resolveDl();
    dtfSpy.mockRestore();
    downloadSpy.mockRestore();
  });
});

