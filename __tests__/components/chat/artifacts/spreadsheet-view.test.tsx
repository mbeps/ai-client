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

  it("renders spreadsheet grid when a header cell is empty or duplicate", () => {
    const dataWithEmptyHeader = [
      ["", "Age", "", "Age"],
      ["Alice", 25, "Bob", 30],
    ];

    render(
      <SpreadsheetView
        title="Empty and Duplicate Headers"
        content={JSON.stringify(dataWithEmptyHeader)}
      />,
    );

    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    expect(screen.getAllByText("Age").length).toBeGreaterThan(0);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders spreadsheet grid for CSV with leading or trailing empty commas", () => {
    const csvContent = ",Age,Score,\nAlice,25,95,foo";

    render(
      <SpreadsheetView
        title="CSV with empty headers"
        content={csvContent}
      />,
    );

    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders spreadsheet grid for array of objects with dotted keys", () => {
    const aooWithDots = [
      { "user.name": "Alice", "version 1.0": "v1" },
      { "user.name": "Bob", "version 1.0": "v2" },
    ];

    render(
      <SpreadsheetView
        title="Dotted Keys Sheet"
        content={JSON.stringify(aooWithDots)}
      />,
    );

    expect(screen.queryByText("Empty Spreadsheet")).not.toBeInTheDocument();
    expect(screen.getByText("user.name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders data rows that have more columns than header row", () => {
    const wideData = [
      ["Col1"],
      ["Val1", "Val2", "Val3"],
    ];

    render(
      <SpreadsheetView
        title="Wide Data Rows"
        content={JSON.stringify(wideData)}
      />,
    );

    expect(screen.getByText("Col1")).toBeInTheDocument();
    expect(screen.getByText("Column 2")).toBeInTheDocument();
    expect(screen.getByText("Column 3")).toBeInTheDocument();
    expect(screen.getByText("Val2")).toBeInTheDocument();
  });
});
