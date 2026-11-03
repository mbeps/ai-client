import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ToolTraceResultPanel,
  ToolTraceStep,
  ToolTraceTitle,
} from "@/components/chat/message/tool-trace-step";

describe("ToolTraceTitle", () => {
  it("renders simple tool name when isMcp is false", () => {
    render(<ToolTraceTitle isMcp={false} toolName="web_search" />);
    expect(screen.getByText("web_search")).toBeDefined();
  });

  it("renders server name and tool name when isMcp is true and serverName exists", () => {
    render(
      <ToolTraceTitle
        isMcp={true}
        serverName="github"
        toolName="list_issues"
      />,
    );
    expect(screen.getByText("github")).toBeDefined();
    expect(screen.getByText("list_issues")).toBeDefined();
  });

  it("renders fallback tool name when isMcp is true but serverName is missing", () => {
    render(<ToolTraceTitle isMcp={true} toolName="list_issues" />);
    expect(screen.getByText("list_issues")).toBeDefined();
  });
});

describe("ToolTraceResultPanel", () => {
  it("renders string result directly", () => {
    render(
      <ToolTraceResultPanel isError={false} result="Operation completed" />,
    );
    expect(screen.getByText("Operation completed")).toBeDefined();
  });

  it("renders json stringified result for objects", () => {
    render(
      <ToolTraceResultPanel
        isError={false}
        result={{ status: "ok", count: 42 }}
      />,
    );
    expect(screen.getByText(/"count": 42/)).toBeDefined();
  });

  it("renders error styling when isError is true", () => {
    const { container } = render(
      <ToolTraceResultPanel isError={true} result="Fatal error" />,
    );
    expect(container.querySelector(".bg-destructive\\/5")).not.toBeNull();
  });
});

describe("ToolTraceStep", () => {
  it("renders running state", () => {
    render(
      <ToolTraceStep
        toolCallId="tc-1"
        toolName="calculate"
        isMcp={false}
        args={{ a: 1, b: 2 }}
        state="running"
      />,
    );

    expect(screen.getByText("calculate")).toBeDefined();
    expect(screen.getByText("Running...")).toBeDefined();
  });

  it("renders error state with failed description and details when expanded", () => {
    render(
      <ToolTraceStep
        toolCallId="tc-2"
        toolName="calculate"
        isMcp={false}
        args={{ a: 1 }}
        result={{ error: "Division by zero" }}
        state="error"
      />,
    );

    expect(screen.getByText("Failed")).toBeDefined();

    // Expand accordion
    fireEvent.click(screen.getByText("calculate"));
    expect(screen.getByText("Result")).toBeDefined();
    expect(screen.getByText(/"Division by zero"/)).toBeDefined();
  });

  it("renders done state with success description and details when expanded", () => {
    render(
      <ToolTraceStep
        toolCallId="tc-3"
        toolName="calculate"
        serverName="math-server"
        isMcp={true}
        args={{ a: 5, b: 5 }}
        result={{ sum: 10 }}
        state="done"
      />,
    );

    expect(screen.getByText("math-server")).toBeDefined();
    expect(screen.getByText("calculate")).toBeDefined();
    expect(screen.getByText("Success")).toBeDefined();

    // Expand accordion
    fireEvent.click(screen.getByText("calculate"));
    expect(screen.getByText("Result")).toBeDefined();
    expect(screen.getByText(/"sum": 10/)).toBeDefined();
  });
});
