"use client";

import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Client-side Mermaid diagram renderer component.
 * Dynamically imports Mermaid to avoid SSR hydration mismatches, renders the diagram
 * to SVG, and displays a loading skeleton or error message during render.
 * Each render uses a unique ID to prevent conflicts in multi-diagram scenarios.
 *
 * @param props.chart - Raw Mermaid diagram definition string (e.g., "graph TD; A-->B").
 * @returns Centered SVG container, loading skeleton, or error message.
 * @author Maruf Bepary
 */
const MermaidBlock = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const renderChart = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        // Use a unique ID for each render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: svgCode } = await mermaid.render(id, chart);
        setSvg(svgCode);
      } catch (e: any) {
        setError(e?.message || "Failed to render mermaid chart");
      }
    };
    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md font-mono text-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="animate-pulse h-24 bg-muted rounded-md flex items-center justify-center">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      className="flex justify-center overflow-auto my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * Renders assistant message content as rich Markdown.
 * Supports GFM tables, strikethrough, KaTeX math expressions (inline `$…$` and block `$$…$$`),
 * raw HTML, and Mermaid diagram fenced code blocks. Applies Tailwind prose styling
 * with Shadcn-style overrides for tables, code blocks, and links.
 * Mermaid diagrams are rendered client-side to SVG via dynamic import to avoid SSR issues.
 *
 * @param props.content - Raw Markdown string to render with all supported extensions.
 * @returns Prose container with React Markdown, KaTeX, and Mermaid integration.
 * @see MermaidBlock for Mermaid diagram rendering details.
 * @author Maruf Bepary
 */
export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-stone dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            if (!inline && language === "mermaid") {
              return (
                <MermaidBlock chart={String(children).replace(/\n$/, "")} />
              );
            }

            return !inline ? (
              <div className="relative my-4 rounded-lg bg-muted p-4 overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </div>
            ) : (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-sm text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Customizing other elements for better Shadcn-like appearance
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm text-left" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border-b font-medium p-2 bg-muted/50" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b p-2" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
