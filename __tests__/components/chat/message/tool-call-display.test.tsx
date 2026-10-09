import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";

describe("ToolCallDisplay", () => {
  it("renders non-MCP tool calls with only toolName", () => {
    render(
      <ToolCallDisplay
        toolCalls={[
          {
            toolCallId: "call-1",
            toolName: "search_web",
            args: { query: "vitest" },
          },
        ]}
        toolResults={[
          {
            toolCallId: "call-1",
            toolName: "search_web",
            result: { results: ["test"] },
          },
        ]}
        initialOpen
      />,
    );

    expect(screen.getByText("search_web")).toBeInTheDocument();
    expect(screen.getByText("Context Usage")).toBeInTheDocument();
    expect(screen.getByText(/~[0-9]+ tokens/)).toBeInTheDocument();
  });

  it("renders MCP tool calls with serverName and dot separator icon", () => {
    const { container } = render(
      <ToolCallDisplay
        toolCalls={[
          {
            toolCallId: "call-2",
            toolName: "create_sheet",
            serverName: "Excel MCP",
            args: { title: "Monthly Report" },
          },
        ]}
        toolResults={[
          {
            toolCallId: "call-2",
            toolName: "create_sheet",
            serverName: "Excel MCP",
            result: { success: true },
          },
        ]}
        initialOpen
      />,
    );

    expect(screen.getByText("Excel MCP")).toBeInTheDocument();
    expect(screen.getByText("create_sheet")).toBeInTheDocument();
    // Verify separator icon SVG exists
    const circleIcon = container.querySelector("svg.lucide-circle");
    expect(circleIcon).toBeInTheDocument();
    expect(screen.getByText("Context Usage")).toBeInTheDocument();
  });
});

