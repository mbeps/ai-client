"use client";

import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

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
      <div className="not-typeset bg-destructive/10 text-destructive rounded-md p-4 font-mono text-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="not-typeset bg-muted flex h-24 animate-pulse items-center justify-center rounded-md">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      className="not-typeset my-4 flex justify-center overflow-auto"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized Mermaid diagram SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * Code block with header bar, language badge, and copy-to-clipboard button.
 */
function CodeBlock({ language, value }: { language?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error in restricted environments
    }
  };

  return (
    <div className="border-border bg-muted/60 dark:bg-muted/30 relative my-4 overflow-hidden rounded-lg border font-mono text-sm">
      <div className="border-border bg-muted/90 text-muted-foreground dark:bg-muted/60 flex items-center justify-between border-b px-4 py-1.5 text-xs select-none">
        <span className="font-mono lowercase">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="text-foreground m-0 bg-transparent p-0 font-mono text-sm leading-relaxed whitespace-pre">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Renders assistant and user message content or preview text as rich Markdown.
 * Uses Shadcn Typeset (`typeset typeset-chat`) for container-aware typography,
 * consistent rhythm, and streaming stability, augmented with interactive code blocks
 * and client-side Mermaid diagrams.
 *
 * @param props.content - Raw Markdown string to render with all supported extensions.
 * @param props.className - Optional additional classes for the typeset wrapper.
 * @returns Typeset container with React Markdown, KaTeX, and Mermaid integration.
 */
export function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn("typeset typeset-chat max-w-none break-words", className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeKatex,
        ]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <h1
              className="border-border text-foreground mt-6 mb-3 border-b pb-1 text-2xl font-bold tracking-tight first:mt-0"
              {...props}
            />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2
              className="border-border/50 text-foreground mt-5 mb-2.5 border-b pb-1 text-xl font-semibold tracking-tight first:mt-0"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3
              className="text-foreground mt-4 mb-2 text-lg font-semibold tracking-tight first:mt-0"
              {...props}
            />
          ),
          h4: ({ node: _node, ...props }) => (
            <h4
              className="text-foreground mt-3 mb-1.5 text-base font-semibold first:mt-0"
              {...props}
            />
          ),
          h5: ({ node: _node, ...props }) => (
            <h5
              className="text-muted-foreground mt-2 mb-1 text-sm font-semibold tracking-wider uppercase first:mt-0"
              {...props}
            />
          ),
          h6: ({ node: _node, ...props }) => (
            <h6
              className="text-muted-foreground mt-2 mb-1 text-xs font-semibold tracking-wider uppercase first:mt-0"
              {...props}
            />
          ),
          p: ({ node: _node, ...props }) => (
            <p
              className="text-foreground my-3 leading-7 first:mt-0 last:mb-0"
              {...props}
            />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul
              className="text-foreground my-3 list-disc space-y-1 pl-6 [&>li>ol]:my-1 [&>li>ul]:my-1"
              {...props}
            />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol
              className="text-foreground my-3 list-decimal space-y-1 pl-6 [&>li>ol]:my-1 [&>li>ul]:my-1"
              {...props}
            />
          ),
          li: ({ node: _node, ...props }) => (
            <li
              className="marker:text-muted-foreground my-0.5 leading-relaxed"
              {...props}
            />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              className="border-primary/40 bg-muted/20 text-muted-foreground my-3 rounded-r-md border-l-4 py-1.5 pl-4 italic"
              {...props}
            />
          ),
          hr: ({ node: _node, ...props }) => (
            <hr className="border-border my-6" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="text-foreground font-semibold" {...props} />
          ),
          em: ({ node: _node, ...props }) => (
            <em className="italic" {...props} />
          ),
          del: ({ node: _node, ...props }) => (
            <del className="text-muted-foreground line-through" {...props} />
          ),
          input: ({ node: _node, type, ...props }: any) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  className="border-border accent-primary mr-2 inline-block h-4 w-4 cursor-default rounded align-middle"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          code({ node: _node, className: codeCls, children, ...props }: any) {
            return (
              <code
                className={
                  "border-border/50 bg-muted text-foreground rounded-md border px-1.5 py-0.5 font-mono text-xs font-medium" +
                  (codeCls ?? "")
                }
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }: any) {
            const codeEl = Array.isArray(children) ? children[0] : children;
            const cls: string = codeEl?.props?.className ?? "";
            const rawCode = String(codeEl?.props?.children ?? "").replace(
              /\n$/,
              "",
            );

            if (/language-mermaid/.test(cls)) {
              return <MermaidBlock chart={rawCode} />;
            }

            const match = /language-(\w+)/.exec(cls);
            const language = match ? match[1] : undefined;

            return <CodeBlock language={language} value={rawCode} />;
          },
          table: ({ node: _node, ...props }) => (
            <div className="typeset-scroll border-border my-4 overflow-x-auto rounded-lg border">
              <table
                className="w-full border-collapse text-left text-sm"
                {...props}
              />
            </div>
          ),
          thead: ({ node: _node, ...props }) => (
            <thead
              className="border-border bg-muted/50 text-foreground border-b font-semibold"
              {...props}
            />
          ),
          tbody: ({ node: _node, ...props }) => (
            <tbody className="divide-border divide-y" {...props} />
          ),
          tr: ({ node: _node, ...props }) => (
            <tr className="hover:bg-muted/30 transition-colors" {...props} />
          ),
          th: ({ node: _node, ...props }) => (
            <th
              className="border-border border-r p-2.5 text-left font-semibold last:border-r-0"
              {...props}
            />
          ),
          td: ({ node: _node, ...props }) => (
            <td
              className="border-border text-foreground border-r p-2.5 last:border-r-0"
              {...props}
            />
          ),
          a: ({ node: _node, href, ...props }: any) => {
            const isDownloadable = Boolean(
              href &&
                /\.(xlsx|xls|xlsm|csv|tsv|pdf|docx|zip|tar\.gz|gz|parquet|json)$/i.test(
                  String(href).split("?")[0],
                ),
            );
            return (
              <a
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                href={href}
                download={isDownloadable ? true : undefined}
                {...props}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
