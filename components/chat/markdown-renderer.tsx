"use client";

import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Client-side Mermaid diagram renderer.
 * Dynamically imports the Mermaid library to avoid SSR issues, renders the chart
 * to SVG, and displays a loading skeleton or an error message as appropriate.
 *
 * @param props.chart - The raw Mermaid diagram definition string to render.
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
 * Supports GFM tables and strikethrough, KaTeX math (inline `$…$` and block `$$…$$`),
 * raw HTML, and Mermaid fenced code blocks rendered via `MermaidBlock`.
 * Applies Tailwind `prose` styling and Shadcn-style overrides for tables and links.
 *
 * @param props.content - The raw Markdown string to render.
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
