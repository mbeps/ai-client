import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
    themes: ["light", "dark", "system"],
  }),
}));

vi.mock("@/lib/utils/download-file", () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  extractFilenameFromUrl: (url: string) => url.split("/").pop() || "download",
}));

const mountCounts = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));

const mockDynamicUIBlock = vi.hoisted(() =>
  vi.fn(
    ({
      rawSpec,
      isStreaming,
      isUnclosed,
    }: {
      rawSpec: string;
      isStreaming?: boolean;
      isUnclosed?: boolean;
    }) => {
      return (
        <MockDynamicUILifecycle
          rawSpec={rawSpec}
          isStreaming={isStreaming}
          isUnclosed={isUnclosed}
        />
      );
    },
  ),
);

function MockDynamicUILifecycle({
  rawSpec,
  isStreaming,
  isUnclosed,
}: {
  rawSpec: string;
  isStreaming?: boolean;
  isUnclosed?: boolean;
}) {
  useEffect(() => {
    mountCounts.mounts += 1;
    return () => {
      mountCounts.unmounts += 1;
    };
  }, []);

  return (
    <div
      data-testid="dynamic-ui-block"
      data-raw-spec={rawSpec}
      data-is-streaming={String(Boolean(isStreaming))}
      data-is-unclosed={String(Boolean(isUnclosed))}
    >
      {isStreaming && isUnclosed ? "skeleton" : rawSpec}
    </div>
  );
}

vi.mock("@/components/chat/generative-ui/dynamic-ui-block", () => ({
  DynamicUIBlock: (props: {
    rawSpec: string;
    isStreaming?: boolean;
    isUnclosed?: boolean;
  }) => mockDynamicUIBlock(props),
}));

import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

describe("MarkdownRenderer Generative UI integration", () => {
  beforeEach(() => {
    mockDynamicUIBlock.mockClear();
    mountCounts.mounts = 0;
    mountCounts.unmounts = 0;
  });

  it("renders DynamicUIBlock for spec and ui fences while keeping normal code blocks untouched", async () => {
    const content = [
      "Intro prose.",
      "",
      "```spec",
      '{"root":"a","elements":{"a":{"type":"Text","props":{"text":"Spec block"}}}}',
      "```",
      "",
      "```ui",
      '{"root":"b","elements":{"b":{"type":"Text","props":{"text":"UI block"}}}}',
      "```",
      "",
      "```ts",
      "const x = 1;",
      "```",
    ].join("\n");

    render(<MarkdownRenderer content={content} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dynamic-ui-block")).toHaveLength(2);
    });

    const blocks = screen.getAllByTestId("dynamic-ui-block");
    expect(blocks[0].getAttribute("data-raw-spec")).toContain("Spec block");
    expect(blocks[0].getAttribute("data-is-streaming")).toBe("false");
    expect(blocks[0].getAttribute("data-is-unclosed")).toBe("false");
    expect(blocks[1].getAttribute("data-raw-spec")).toContain("UI block");

    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
    expect(screen.getByText("ts")).toBeInTheDocument();
  });

  it("marks only the trailing unclosed UI block as isUnclosed during streaming", async () => {
    const content = [
      "First widget:",
      "",
      "```spec",
      '{"root":"a","elements":{"a":{"type":"Text","props":{"text":"Ready"}}}}',
      "```",
      "",
      "Second widget streaming:",
      "",
      "```spec",
      '{"root":"b","elements":{"b":{"type":"Text"',
    ].join("\n");

    render(<MarkdownRenderer content={content} isStreaming={true} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dynamic-ui-block")).toHaveLength(2);
    });

    const blocks = screen.getAllByTestId("dynamic-ui-block");
    expect(blocks[0].getAttribute("data-is-streaming")).toBe("true");
    expect(blocks[0].getAttribute("data-is-unclosed")).toBe("false");

    expect(blocks[1].getAttribute("data-is-streaming")).toBe("true");
    expect(blocks[1].getAttribute("data-is-unclosed")).toBe("true");
  });

  it("passes isUnclosed=false when isStreaming is false even for an unclosed fence", async () => {
    const content = [
      "Stopped stream:",
      "",
      "```ui",
      '{"root":"b","elements":{"b":',
    ].join("\n");

    render(<MarkdownRenderer content={content} isStreaming={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-ui-block")).toBeInTheDocument();
    });

    const block = screen.getByTestId("dynamic-ui-block");
    expect(block.getAttribute("data-is-streaming")).toBe("false");
    expect(block.getAttribute("data-is-unclosed")).toBe("false");
  });

  it("identifies only the trailing unclosed fence by position even when an earlier closed fence has identical JSON", async () => {
    const identicalJson = '{"root":"a","elements":{"a":{"type":"Text","props":{"content":"Same"}}}}';
    const content = [
      "Closed widget:",
      "",
      "```spec",
      identicalJson,
      "```",
      "",
      "Trailing unclosed widget with identical body:",
      "",
      "```spec",
      identicalJson,
    ].join("\n");

    render(<MarkdownRenderer content={content} isStreaming={true} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dynamic-ui-block")).toHaveLength(2);
    });

    const blocks = screen.getAllByTestId("dynamic-ui-block");
    expect(blocks[0].getAttribute("data-is-unclosed")).toBe("false");
    expect(blocks[1].getAttribute("data-is-unclosed")).toBe("true");
  });

  it("does not unmount DynamicUIBlock across MarkdownRenderer re-renders or streaming completion", async () => {
    const specBody = '{"root":"a","elements":{"a":{"type":"Text","props":{"content":"Stable"}}}}';
    const content = `Intro\n\n\`\`\`spec\n${specBody}\n\`\`\`\n\nOutro`;

    const { rerender } = render(
      <MarkdownRenderer content={content} isStreaming={true} className="a" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-ui-block")).toBeInTheDocument();
    });
    expect(mountCounts.mounts).toBe(1);
    expect(mountCounts.unmounts).toBe(0);

    rerender(
      <MarkdownRenderer content={content} isStreaming={false} className="b" />,
    );

    expect(mountCounts.mounts).toBe(1);
    expect(mountCounts.unmounts).toBe(0);
  });
});
