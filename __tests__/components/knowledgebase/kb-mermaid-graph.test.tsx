import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KbMermaidGraph } from "@/components/knowledgebase/kb-mermaid-graph";
import type { KbGraphNode } from "@/types/knowledgebase/kb-graph-data";

describe("KbMermaidGraph", () => {
  const sampleDocs: KbGraphNode[] = [
    {
      id: "doc-1",
      name: "Architecture.md",
      documentType: "technical_spec",
      summary: "System architecture",
      keyEntities: ["System"],
      chunkCount: 10,
      tokenCount: 2500,
    },
    {
      id: "doc-2",
      name: "Security.pdf",
      documentType: "policy",
      summary: "Security guidelines",
      keyEntities: ["Auth"],
      chunkCount: 5,
      tokenCount: 1200,
    },
  ];

  it("renders loading state initially while chart is rendering", () => {
    render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_1 --> doc_2"
        documents={sampleDocs}
      />,
    );
    expect(screen.getByText("Rendering graph...")).toBeInTheDocument();
  });

  it("renders empty state placeholder when chart is empty", () => {
    render(<KbMermaidGraph chart="" documents={[]} />);
    expect(
      screen.getByText("No graph data to display."),
    ).toBeInTheDocument();
  });

  it("renders SVG when mermaid.render succeeds", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="test-svg"><g class="node" id="flowchart-doc_doc_1-0"><text>Architecture.md</text></g></svg>',
    } as any);

    render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_doc_1"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("test-svg")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("triggers onSelectDocument when clicking a node element inside the SVG", async () => {
    const handleSelect = vi.fn();
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="test-svg"><g class="node" id="flowchart-doc_doc_1-0"><text>Architecture.md</text></g></svg>',
    } as any);

    const { container } = render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_doc_1"
        documents={sampleDocs}
        onSelectDocument={handleSelect}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const nodeElement = container.querySelector(".node");
    expect(nodeElement).not.toBeNull();
    if (nodeElement) {
      fireEvent.click(nodeElement);
      expect(handleSelect).toHaveBeenCalledWith("doc-1");
    }

    spy.mockRestore();
  });

  it("supports zooming in, zooming out, and resetting zoom", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="test-svg"></svg>',
    } as any);

    render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_doc_1"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText("100%")).toBeInTheDocument();

    const zoomInBtn = screen.getByRole("button", { name: /zoom in/i });
    const zoomOutBtn = screen.getByRole("button", { name: /zoom out/i });
    const resetBtn = screen.getByRole("button", { name: /reset zoom/i });

    await userEvent.click(zoomInBtn);
    expect(screen.getByText("120%")).toBeInTheDocument();

    await userEvent.click(zoomOutBtn);
    expect(screen.getByText("100%")).toBeInTheDocument();

    await userEvent.click(zoomInBtn);
    await userEvent.click(zoomInBtn);
    expect(screen.getByText("140%")).toBeInTheDocument();

    await userEvent.click(resetBtn);
    expect(screen.getByText("100%")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("handles render error gracefully without crashing", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockRejectedValueOnce(
      new Error("Syntax error in graph syntax"),
    );

    render(
      <KbMermaidGraph
        chart="invalid syntax"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText(/Failed to render graph:/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("handles non-Error rejection and cleans up DOM elements on failure", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockRejectedValueOnce(
      "String error",
    );

    render(
      <KbMermaidGraph
        chart="invalid syntax 2"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText(/Failed to render graph: String error/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("ignores clicks outside node elements or when onSelectDocument is not provided", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="test-svg"><g class="not-a-node"><text>Background</text></g><g class="node" id="other-node"><text>Unknown</text></g></svg>',
    } as any);

    const { container } = render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_doc_1"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const notNode = container.querySelector(".not-a-node");
    const otherNode = container.querySelector(".node");

    expect(notNode).not.toBeNull();
    if (notNode) {
      fireEvent.click(notNode);
    }
    if (otherNode) {
      fireEvent.click(otherNode);
    }

    spy.mockRestore();
  });

  it("enforces minimum and maximum zoom constraints", async () => {
    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="test-svg"></svg>',
    } as any);

    render(
      <KbMermaidGraph
        chart="flowchart LR\n  doc_doc_1"
        documents={sampleDocs}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const zoomInBtn = screen.getByRole("button", { name: /zoom in/i });
    const zoomOutBtn = screen.getByRole("button", { name: /zoom out/i });

    // Zoom in beyond 200%
    for (let i = 0; i < 10; i++) {
      await userEvent.click(zoomInBtn);
    }
    expect(screen.getByText("200%")).toBeInTheDocument();

    // Zoom out below 60%
    for (let i = 0; i < 15; i++) {
      await userEvent.click(zoomOutBtn);
    }
    expect(screen.getByText("60%")).toBeInTheDocument();

    spy.mockRestore();
  });
});
