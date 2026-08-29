"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import type { Block } from "@blocknote/core";
import { useTheme } from "next-themes";
import { Code2, Eye, Sparkles, Loader2 } from "lucide-react";
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
    <div className="h-full w-full overflow-y-auto px-2 py-3 bg-card">
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
    // Parse only once when mounting the BlockNote tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        "w-full rounded-lg border border-input bg-card shadow-2xs overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors",
        className,
      )}
    >
      <Tabs defaultValue={normalizedDefaultTab} className="w-full">
        {/* Integrated Toolbar Header with Seamless Grey Background */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/70 bg-muted/60 dark:bg-muted/30">
          <TabsList className="bg-transparent p-0 h-auto gap-1 border-0 shadow-none">
            <TabsTrigger
              value="rich"
              className="gap-2 text-sm px-3.5 py-1.5 h-8 rounded-md border-0 border-transparent shadow-none data-[state=active]:shadow-xs data-[state=active]:border-0 data-[state=active]:border-transparent dark:data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium transition-all hover:text-foreground cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Rich Text</span>
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="gap-2 text-sm px-3.5 py-1.5 h-8 rounded-md border-0 border-transparent shadow-none data-[state=active]:shadow-xs data-[state=active]:border-0 data-[state=active]:border-transparent dark:data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium transition-all hover:text-foreground cursor-pointer"
            >
              <Code2 className="h-4 w-4" />
              <span>Raw Text</span>
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="gap-2 text-sm px-3.5 py-1.5 h-8 rounded-md border-0 border-transparent shadow-none data-[state=active]:shadow-xs data-[state=active]:border-0 data-[state=active]:border-transparent dark:data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium transition-all hover:text-foreground cursor-pointer"
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
              "overflow-y-auto text-sm flex flex-col bg-card",
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
              "w-full border-0 rounded-none shadow-none focus-visible:ring-0 focus:ring-0 resize-y px-6 py-4 bg-transparent font-mono text-sm leading-relaxed overflow-y-auto",
              minHeight,
              maxHeight,
              textareaClassName,
            )}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0 focus-visible:outline-hidden">
          <div
            className={cn(
              "px-6 py-4 overflow-y-auto text-sm bg-card",
              minHeight,
              maxHeight,
            )}
          >
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[160px] text-muted-foreground text-sm italic">
                No markdown content to preview
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
