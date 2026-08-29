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
import { Check, Copy } from "lucide-react";
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
      <div className="not-typeset p-4 bg-destructive/10 text-destructive rounded-md font-mono text-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="not-typeset animate-pulse h-24 bg-muted rounded-md flex items-center justify-center">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      className="not-typeset flex justify-center overflow-auto my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * Code block with header bar, language badge, and copy-to-clipboard button.
 */
function CodeBlock({
  language,
  value,
}: {
  language?: string;
  value: string;
}) {
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
    <div className="relative my-4 rounded-lg border border-border bg-muted/60 dark:bg-muted/30 overflow-hidden font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-muted/90 dark:bg-muted/60 border-b border-border text-xs text-muted-foreground select-none">
        <span className="font-mono lowercase">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5 rounded text-xs"
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
      <div className="p-4 overflow-x-auto">
        <pre className="m-0 p-0 bg-transparent text-foreground font-mono text-sm leading-relaxed whitespace-pre">
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
    <div className={cn("typeset typeset-chat max-w-none break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeKatex,
        ]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="text-2xl font-bold tracking-tight mt-6 mb-3 pb-1 border-b border-border first:mt-0 text-foreground"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="text-xl font-semibold tracking-tight mt-5 mb-2.5 pb-1 border-b border-border/50 first:mt-0 text-foreground"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="text-lg font-semibold tracking-tight mt-4 mb-2 first:mt-0 text-foreground"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="text-base font-semibold mt-3 mb-1.5 first:mt-0 text-foreground"
              {...props}
            />
          ),
          h5: ({ node, ...props }) => (
            <h5
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1 first:mt-0"
              {...props}
            />
          ),
          h6: ({ node, ...props }) => (
            <h6
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1 first:mt-0"
              {...props}
            />
          ),
          p: ({ node, ...props }) => (
            <p className="leading-7 my-3 first:mt-0 last:mb-0 text-foreground" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul
              className="list-disc pl-6 my-3 space-y-1 text-foreground [&>li>ul]:my-1 [&>li>ol]:my-1"
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="list-decimal pl-6 my-3 space-y-1 text-foreground [&>li>ol]:my-1 [&>li>ul]:my-1"
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed my-0.5 marker:text-muted-foreground" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-primary/40 pl-4 py-1.5 my-3 italic text-muted-foreground bg-muted/20 rounded-r-md"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => <hr className="my-6 border-border" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          del: ({ node, ...props }) => (
            <del className="line-through text-muted-foreground" {...props} />
          ),
          input: ({ node, type, ...props }: any) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 rounded border-border accent-primary cursor-default inline-block align-middle"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          code({ node, className: codeCls, children, ...props }: any) {
            return (
              <code
                className={
                  "bg-muted text-foreground px-1.5 py-0.5 rounded-md text-xs font-mono font-medium border border-border/50 " +
                  (codeCls ?? "")
                }
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ node, children, ...props }: any) {
            const codeEl = Array.isArray(children) ? children[0] : children;
            const cls: string = codeEl?.props?.className ?? "";
            const rawCode = String(codeEl?.props?.children ?? "").replace(/\n$/, "");

            if (/language-mermaid/.test(cls)) {
              return <MermaidBlock chart={rawCode} />;
            }

            const match = /language-(\w+)/.exec(cls);
            const language = match ? match[1] : undefined;

            return <CodeBlock language={language} value={rawCode} />;
          },
          table: ({ node, ...props }) => (
            <div className="typeset-scroll overflow-x-auto my-4 rounded-lg border border-border">
              <table className="w-full text-sm text-left border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead
              className="bg-muted/50 border-b border-border font-semibold text-foreground"
              {...props}
            />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/30 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="p-2.5 font-semibold text-left border-r border-border last:border-r-0"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2.5 border-r border-border last:border-r-0 text-foreground" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors"
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
