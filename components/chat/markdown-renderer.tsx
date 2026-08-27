"use client";

import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Sanitisation schema: defaultSchema already covers GFM task-list checkboxes
 * (`input[type=checkbox]` with `checked`/`disabled`). Extended only for KaTeX
 * output — class names on span/div/code and the MathML tags KaTeX emits.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "msqrt",
    "mroot",
    "munder",
    "mover",
    "munderover",
    "mphantom",
    "menclose",
    "mstyle",
    "mtable",
    "mtr",
    "mtd",
    "mspace",
    "annotation",
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    div: [...(defaultSchema.attributes?.div ?? []), "className"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
  },
};

/**
 * Client-side Mermaid diagram renderer component.
 * Dynamically imports Mermaid to avoid SSR hydration mismatches, renders the diagram
 * to SVG, and displays a loading skeleton or error message during render.
 * Each render uses a unique ID to prevent conflicts in multi-diagram scenarios.
 *
 * @param props.chart - Raw Mermaid diagram definition string (e.g., "graph TD; A-->B").
 * @returns Centered SVG container, loading skeleton, or error message.
 */
const MermaidBlock = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const renderChart = async () => {
      setError("");
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        // Use a unique ID for each render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
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
 */
export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-stone dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeKatex,
        ]}
        components={{
          // react-markdown v10 no longer passes an `inline` prop: bare `code`
          // elements are inline spans, fenced blocks arrive wrapped in `pre`.
          code({ node, className, children, ...props }: any) {
            return (
              <code
                className={
                  "bg-muted px-1.5 py-0.5 rounded-sm text-sm font-mono " +
                  (className ?? "")
                }
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ node, children, ...props }: any) {
            // Fenced mermaid blocks arrive as <pre><code class="language-mermaid">
            const codeEl = Array.isArray(children) ? children[0] : children;
            const cls: string = codeEl?.props?.className ?? "";
            if (/language-mermaid/.test(cls)) {
              const chart = String(codeEl.props.children).replace(/\n$/, "");
              return <MermaidBlock chart={chart} />;
            }
            return (
              <div className="relative my-4 rounded-lg bg-muted p-4 overflow-x-auto">
                <pre {...props}>{children}</pre>
              </div>
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
