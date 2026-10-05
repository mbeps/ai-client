"use client";

import "katex/dist/katex.min.css";
import { defaultSchema } from "hast-util-sanitize";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
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
      <div className="not-typeset rounded-md bg-destructive/10 p-4 font-mono text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="not-typeset flex h-24 animate-pulse items-center justify-center rounded-md bg-muted">
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
    <div className="relative my-4 overflow-hidden rounded-lg border border-border bg-muted/60 font-mono text-sm dark:bg-muted/30">
      <div className="flex select-none items-center justify-between border-border border-b bg-muted/90 px-4 py-1.5 text-muted-foreground text-xs dark:bg-muted/60">
        <span className="font-mono lowercase">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:text-foreground"
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
        <pre className="m-0 whitespace-pre bg-transparent p-0 font-mono text-foreground text-sm leading-relaxed">
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
              className="mt-6 mb-3 border-border border-b pb-1 font-bold text-2xl text-foreground tracking-tight first:mt-0"
              {...props}
            />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2
              className="mt-5 mb-2.5 border-border/50 border-b pb-1 font-semibold text-foreground text-xl tracking-tight first:mt-0"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3
              className="mt-4 mb-2 font-semibold text-foreground text-lg tracking-tight first:mt-0"
              {...props}
            />
          ),
          h4: ({ node: _node, ...props }) => (
            <h4
              className="mt-3 mb-1.5 font-semibold text-base text-foreground first:mt-0"
              {...props}
            />
          ),
          h5: ({ node: _node, ...props }) => (
            <h5
              className="mt-2 mb-1 font-semibold text-muted-foreground text-sm uppercase tracking-wider first:mt-0"
              {...props}
            />
          ),
          h6: ({ node: _node, ...props }) => (
            <h6
              className="mt-2 mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider first:mt-0"
              {...props}
            />
          ),
          p: ({ node: _node, ...props }) => (
            <p
              className="my-3 text-foreground leading-7 first:mt-0 last:mb-0"
              {...props}
            />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul
              className="my-3 list-disc space-y-1 pl-6 text-foreground [&>li>ol]:my-1 [&>li>ul]:my-1"
              {...props}
            />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol
              className="my-3 list-decimal space-y-1 pl-6 text-foreground [&>li>ol]:my-1 [&>li>ul]:my-1"
              {...props}
            />
          ),
          li: ({ node: _node, ...props }) => (
            <li
              className="my-0.5 leading-relaxed marker:text-muted-foreground"
              {...props}
            />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              className="my-3 rounded-r-md border-primary/40 border-l-4 bg-muted/20 py-1.5 pl-4 text-muted-foreground italic"
              {...props}
            />
          ),
          hr: ({ node: _node, ...props }) => (
            <hr className="my-6 border-border" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
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
                  className="mr-2 inline-block h-4 w-4 cursor-default rounded border-border align-middle accent-primary"
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
                  "rounded-md border border-border/50 bg-muted px-1.5 py-0.5 font-medium font-mono text-foreground text-xs" +
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
            <div className="typeset-scroll my-4 overflow-x-auto rounded-lg border border-border">
              <table
                className="w-full border-collapse text-left text-sm"
                {...props}
              />
            </div>
          ),
          thead: ({ node: _node, ...props }) => (
            <thead
              className="border-border border-b bg-muted/50 font-semibold text-foreground"
              {...props}
            />
          ),
          tbody: ({ node: _node, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node: _node, ...props }) => (
            <tr className="transition-colors hover:bg-muted/30" {...props} />
          ),
          th: ({ node: _node, ...props }) => (
            <th
              className="border-border border-r p-2.5 text-left font-semibold last:border-r-0"
              {...props}
            />
          ),
          td: ({ node: _node, ...props }) => (
            <td
              className="border-border border-r p-2.5 text-foreground last:border-r-0"
              {...props}
            />
          ),
          a: ({ node: _node, ...props }) => (
            <a
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
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
