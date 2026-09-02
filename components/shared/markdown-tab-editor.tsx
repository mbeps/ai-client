"use client";

import type { Block } from "@blocknote/core";
import { useEffect, useRef, useState } from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { Code2, Eye, Loader2, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Props for MarkdownTabEditor component.
 * Supports 3 integrated tabs: Rich Text (BlockNote), Raw Text, and Markdown Preview.
 *
 * @author Maruf Bepary
 */
export interface MarkdownTabEditorProps {
  /** Current markdown text value */
  value: string;
  /** Callback fired when content changes in Raw or Rich Text mode */
  onChange: (value: string) => void;
  /** Placeholder text for Raw and Rich Text modes */
  placeholder?: string;
  /** Additional container className */
  className?: string;
  /** Additional textarea className */
  textareaClassName?: string;
  /** Minimum height class (e.g. "min-h-[280px]") */
  minHeight?: string;
  /** Maximum height class (e.g. "max-h-[600px]") */
  maxHeight?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Default active tab: "rich" (default), "raw", or "preview" (accepts "blocknote" as alias) */
  defaultTab?: "rich" | "raw" | "preview" | "blocknote";
  /** Optional ref forwarded to raw textarea */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

/**
 * Inner editor component using BlockNote.
 * Converts blocks to markdown lossy on change and debounces calls to `onChange`.
 * Flushes the latest markdown on unmount.
 *
 * @param blocks - Initial BlockNote blocks parsed from markdown
 * @param onChange - Callback to update parent markdown state
 * @param disabled - Whether editing is disabled
 */
function InnerBlockNoteEditor({
  blocks,
  onChange,
  disabled,
}: {
  blocks: Block[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const editor = useCreateBlockNote({
    initialContent: blocks.length > 0 ? blocks : undefined,
  });

  const { resolvedTheme } = useTheme();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const latestMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (latestMarkdownRef.current !== null) {
        onChange(latestMarkdownRef.current);
      }
    };
  }, [onChange]);

  return (
    <div className="h-full w-full overflow-y-auto bg-card px-2 py-3">
      <BlockNoteView
        editor={editor}
        editable={!disabled}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(async () => {
            try {
              const markdown = await editor.blocksToMarkdownLossy(
                editor.document,
              );
              latestMarkdownRef.current = markdown;
              onChange(markdown);
            } catch (err) {
              console.error(
                "Failed to serialize BlockNote blocks to markdown",
                err,
              );
            }
          }, 300);
        }}
      />
    </div>
  );
}

/**
 * Client-only wrapper that asynchronously parses markdown content into BlockNote blocks on mount.
 *
 * @param content - Initial markdown string
 * @param onChange - Callback to update parent markdown state
 * @param disabled - Whether editing is disabled
 */
function BlockNoteTabContent({
  content,
  onChange,
  disabled,
}: {
  content: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [parsedBlocks, setParsedBlocks] = useState<Block[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function parse() {
      try {
        const { BlockNoteEditor: BNEditor } = await import("@blocknote/core");
        const tempEditor = BNEditor.create();
        const blocks = await tempEditor.tryParseMarkdownToBlocks(content);
        if (!cancelled) {
          setParsedBlocks(blocks);
        }
      } catch (err) {
        console.error("Failed to parse markdown to BlockNote blocks", err);
        if (!cancelled) {
          setParsedBlocks([]);
        }
      }
    }

    parse();
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (!parsedBlocks) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <InnerBlockNoteEditor
      blocks={parsedBlocks}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * Integrated 3-tab Markdown editor component.
 * Features a unified toolbar header with borderless integrated tab switches:
 * - Rich Text (interactive Notion-like visual block editor powered by BlockNote, default)
 * - Raw Text (direct monospace markdown textarea with comfortable edge spacing)
 * - Preview (rendered markdown with KaTeX and GFM typography)
 *
 * @author Maruf Bepary
 */
export function MarkdownTabEditor({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  minHeight = "min-h-[280px]",
  maxHeight = "max-h-[600px]",
  disabled = false,
  defaultTab = "rich",
  textareaRef,
}: MarkdownTabEditorProps) {
  // Normalize "blocknote" alias to "rich" for seamless backward compatibility
  const normalizedDefaultTab = defaultTab === "blocknote" ? "rich" : defaultTab;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-input bg-card shadow-2xs transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <Tabs defaultValue={normalizedDefaultTab} className="w-full">
        {/* Integrated Toolbar Header with Seamless Grey Background */}
        <div className="flex items-center justify-between border-border/70 border-b bg-muted/60 px-3 py-2 dark:bg-muted/30">
          <TabsList className="h-auto gap-1 border-0 bg-transparent p-0 shadow-none">
            <TabsTrigger
              value="rich"
              className="h-8 cursor-pointer gap-2 rounded-md border-0 border-transparent px-3.5 py-1.5 font-medium text-muted-foreground text-sm shadow-none transition-all hover:text-foreground data-[state=active]:border-0 data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:border-transparent"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Rich Text</span>
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="h-8 cursor-pointer gap-2 rounded-md border-0 border-transparent px-3.5 py-1.5 font-medium text-muted-foreground text-sm shadow-none transition-all hover:text-foreground data-[state=active]:border-0 data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:border-transparent"
            >
              <Code2 className="h-4 w-4" />
              <span>Raw Text</span>
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-8 cursor-pointer gap-2 rounded-md border-0 border-transparent px-3.5 py-1.5 font-medium text-muted-foreground text-sm shadow-none transition-all hover:text-foreground data-[state=active]:border-0 data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:border-transparent"
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents seamlessly integrated directly under the header */}
        <TabsContent value="rich" className="mt-0 focus-visible:outline-hidden">
          <div
            className={cn(
              "flex flex-col overflow-y-auto bg-card text-sm",
              minHeight,
              maxHeight,
            )}
          >
            <BlockNoteTabContent
              content={value}
              onChange={onChange}
              disabled={disabled}
            />
          </div>
        </TabsContent>

        <TabsContent value="raw" className="mt-0 focus-visible:outline-hidden">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full resize-y overflow-y-auto rounded-none border-0 bg-transparent px-6 py-4 font-mono text-sm leading-relaxed shadow-none focus:ring-0 focus-visible:ring-0",
              minHeight,
              maxHeight,
              textareaClassName,
            )}
          />
        </TabsContent>

        <TabsContent
          value="preview"
          className="mt-0 focus-visible:outline-hidden"
        >
          <div
            className={cn(
              "overflow-y-auto bg-card px-6 py-4 text-sm",
              minHeight,
              maxHeight,
            )}
          >
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <div className="flex h-full min-h-[160px] items-center justify-center text-muted-foreground text-sm italic">
                No markdown content to preview
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
