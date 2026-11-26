import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceList } from "@/components/mcp/resource-list";
import type { McpServer } from "@/types/mcp/mcp-server";

vi.mock("@/components/mcp/mcp-item-list", () => ({
  McpItemList: ({
    fetchItems,
    getItemKey,
    getItemLabel,
    renderContent,
  }: {
    fetchItems: (r: any) => any[];
    getItemKey: (item: any) => string;
    getItemLabel: (item: any) => string;
    renderContent: (item: any) => React.ReactNode;
  }) => {
    const items = fetchItems({
      resources: [
        {
          uri: "file:///a.txt",
          name: "A",
          description: "Desc A",
          mimeType: "text/plain",
        },
        { uri: "file:///b.txt", name: "B" },
      ],
    });
    return (
      <div>
        {items.map((item) => (
          <div key={getItemKey(item)}>
            <span>{getItemLabel(item)}</span>
            {renderContent(item)}
          </div>
        ))}
      </div>
    );
  },
}));

describe("ResourceList", () => {
  it("renders resources with and without description and mimeType", () => {
    render(<ResourceList server={{ id: "srv-1" } as McpServer} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Desc A")).toBeInTheDocument();
    expect(screen.getByText("text/plain")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("file:///b.txt")).toBeInTheDocument();
  });
});
