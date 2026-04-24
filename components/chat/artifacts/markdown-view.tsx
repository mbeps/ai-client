"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { Block } from "@blocknote/core";

export interface MarkdownViewProps {
  id?: string;
  content: string;
  onUpdate?: (content: string) => void;
}

/**
 * Inner editor component that only mounts once parsed blocks are available.
 * This ensures `useCreateBlockNote` receives the correct `initialContent`
 * on its first (and only) initialization.
 */
function BlockNoteEditor({ blocks, onUpdate }: { blocks: Block[], onUpdate?: (content: string) => void }) {
  const editor = useCreateBlockNote({
    initialContent: blocks.length > 0 ? blocks : undefined,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <div className="h-full w-full bg-background p-4 overflow-y-auto custom-scrollbar">
      <BlockNoteView 
        editor={editor} 
        theme="light" 
        onChange={() => {
          if (onUpdate) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              const markdown = editor.blocksToMarkdownLossy(editor.document);
              onUpdate(markdown);
            }, 1000);
          }
        }}
      />
    </div>
  );
}

/**
 * Markdown artifact view that parses markdown content into BlockNote blocks,
 * then renders the editor once parsing is complete.
 */
export default function MarkdownView({ id, content, onUpdate }: MarkdownViewProps) {
  const [parsedBlocks, setParsedBlocks] = useState<Block[] | null>(null);

  // We only want to parse the initial content when the id changes, 
  // not on every content update, to avoid re-parsing while typing.
  useEffect(() => {
    let cancelled = false;

    async function parseMarkdown() {
      try {
        const { BlockNoteEditor: BNEditor } = await import("@blocknote/core");
        const tempEditor = BNEditor.create();
        const blocks = await tempEditor.tryParseMarkdownToBlocks(content);
        if (!cancelled) {
          setParsedBlocks(blocks);
        }
      } catch (err) {
        console.error("Failed to parse markdown", err);
        if (!cancelled) {
          setParsedBlocks([]);
        }
      }
    }

    parseMarkdown();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!parsedBlocks) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return <BlockNoteEditor key={id ?? "static"} blocks={parsedBlocks} onUpdate={onUpdate} />;
}
