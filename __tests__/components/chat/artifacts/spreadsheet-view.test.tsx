import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpreadsheetView } from "@/components/chat/artifacts/spreadsheet-view";

describe("SpreadsheetView", () => {
  it("renders empty spreadsheet banner when content is empty object string", () => {
    render(<SpreadsheetView title="Empty Test" content="{}" />);

    expect(screen.getByText("Empty Spreadsheet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No rows or valid sheet data found in this spreadsheet artifact.",
      ),
    ).toBeInTheDocument();
  });

  it("renders empty spreadsheet banner when content has empty sheets array", () => {
    render(
      <SpreadsheetView
        title="Empty Sheets"
        content={JSON.stringify({ sheets: [] })}
      />,
    );

    expect(screen.getByText("Empty Spreadsheet")).toBeInTheDocument();
  });

  it("renders spreadsheet grid when valid multi-sheet data is provided", () => {
    const data = {
      sheets: [
        {
          name: "Sheet1",
          data: [
            ["Header1", "Header2"],
            ["Val1", "Val2"],
          ],
        },
      ],
    };

    render(
      <SpreadsheetView
        title="Valid Sheet"
        content={JSON.stringify(data)}
      />,
    );

    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    expect(screen.getByText("Header1")).toBeInTheDocument();
    expect(screen.getByText("Val1")).toBeInTheDocument();
  });

  it("renders spreadsheet grid for legacy array of arrays", () => {
    const legacyArray = [
      ["ColA", "ColB"],
      [10, 20],
    ];

    render(
      <SpreadsheetView
        title="Legacy Sheet"
        content={JSON.stringify(legacyArray)}
      />,
    );

    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    expect(screen.getByText("ColA")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders empty sheet message when active sheet has empty data", () => {
    const data = {
      sheets: [
        {
          name: "EmptySheet",
          data: [],
        },
        {
          name: "ValidSheet",
          data: [["A", "B"], ["1", "2"]],
        },
      ],
    };

    render(
      <SpreadsheetView
        title="Partial Sheet"
        content={JSON.stringify(data)}
      />,
    );

    // Because at least one sheet has data, the main empty spreadsheet state is not shown
    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    // But since the first sheet (activeSheet) has 0 rows:
    expect(screen.getByText("This sheet contains no data.")).toBeInTheDocument();
  });
});
