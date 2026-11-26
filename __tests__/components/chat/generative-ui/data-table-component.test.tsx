import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTableComponent } from "@/components/chat/generative-ui/data-table-component";

const columns = [
  { key: "name", label: "Name" },
  { key: "score", label: "Score" },
  { key: "meta", label: "Meta", sortable: false },
];

const rows = [
  { name: "Charlie", score: 20, meta: { tag: "c" } },
  { name: "Alice", score: 30, meta: null },
  { name: "Bob", score: 10, meta: "ok" },
];

describe("DataTableComponent", () => {
  it("renders rows, headers, and safely formats null and object cells", () => {
    render(<DataTableComponent columns={columns} data={rows} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText('{"tag":"c"}')).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(<DataTableComponent columns={columns} data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("filters rows client-side when searchable is enabled", () => {
    render(
      <DataTableComponent columns={columns} data={rows} searchable />,
    );

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "alice" } });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText("No matching rows")).toBeInTheDocument();
  });

  it("bypasses saved search query when searchable changes to false", () => {
    const { rerender } = render(
      <DataTableComponent columns={columns} data={rows} searchable />,
    );

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "alice" } });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    rerender(
      <DataTableComponent columns={columns} data={rows} searchable={false} />,
    );

    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("sorts sortable columns ascending, descending, and resets on third click", () => {
    render(<DataTableComponent columns={columns} data={rows} />);

    const nameHeaderBtn = screen.getByRole("button", { name: /Name/i });
    const getFirstRowName = () => {
      const cells = screen.getAllByRole("cell");
      return cells[0]?.textContent;
    };

    // Initial order: Charlie
    expect(getFirstRowName()).toBe("Charlie");

    // 1st click: ascending -> Alice
    fireEvent.click(nameHeaderBtn);
    expect(getFirstRowName()).toBe("Alice");

    // 2nd click: descending -> Charlie
    fireEvent.click(nameHeaderBtn);
    expect(getFirstRowName()).toBe("Charlie");

    // 3rd click: unsorted -> original order (Charlie)
    fireEvent.click(nameHeaderBtn);
    expect(getFirstRowName()).toBe("Charlie");

    // Numeric sorting on Score
    const scoreHeaderBtn = screen.getByRole("button", { name: /Score/i });
    fireEvent.click(scoreHeaderBtn);
    expect(getFirstRowName()).toBe("Bob"); // score 10

    // Non-sortable column has no sort button
    expect(screen.queryByRole("button", { name: /Meta/i })).toBeNull();
  });

  it("paginates rows when pageSize is smaller than total rows", () => {
    render(
      <DataTableComponent columns={columns} data={rows} pageSize={2} />,
    );

    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("handles non-array columns and data gracefully", () => {
    render(
      <DataTableComponent
        columns={null as unknown as typeof columns}
        data={null as unknown as typeof rows}
      />,
    );
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
