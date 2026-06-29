"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { Block } from "@blocknote/core";

/**
 * Props for MarkdownView artifact component.
 * Supports bidirectional markdown editing with optional change callbacks.
 *
 * @author Maruf Bepary
 */
export interface MarkdownViewProps {
  /** Optional unique identifier for the artifact; changes trigger re-parsing. */
  id?: string;
  /** Markdown content string to render and edit in BlockNote editor. */
  content: string;
  /** Optional callback fired 1000ms after content changes (debounced). Returns updated markdown. */
  onUpdate?: (content: string) => void;
}

/**
 * Inner editor component that mounts only after markdown blocks are parsed.
 * Ensures `useCreateBlockNote` receives correct `initialContent` on initialization.
 * Debounces markdown export to 1000ms to avoid excessive update callbacks during editing.
 *
 * @param blocks - Pre-parsed BlockNote blocks from markdown content
 * @param onUpdate - Optional callback with debounced markdown export on content changes
 * @author Maruf Bepary
 */
function BlockNoteEditor({
  blocks,
  onUpdate,
}: {
  blocks: Block[];
  onUpdate?: (content: string) => void;
}) {
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
 * Markdown artifact editor powered by BlockNote.
 * Parses markdown content into editable blocks and renders rich editor interface.
 * Re-parses markdown only when `id` changes to avoid re-parsing during editing.
 * Shows loading spinner while parsing; fires debounced updates on content changes.
 *
 * @param id - Optional artifact identifier; changes trigger markdown re-parsing
 * @param content - Markdown string to render and edit
 * @param onUpdate - Optional callback with debounced markdown output after edits
 * @returns BlockNote editor UI or loading spinner while parsing
 * @author Maruf Bepary
 */
export default function MarkdownView({
  id,
  content,
  onUpdate,
}: MarkdownViewProps) {
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

  return (
    <BlockNoteEditor
      key={id ?? "static"}
      blocks={parsedBlocks}
      onUpdate={onUpdate}
    />
  );
}
