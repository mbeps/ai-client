"use client";

import type { Block } from "@blocknote/core";
import { logger } from "@/lib/logger";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Props for MarkdownView artifact component.
 * Supports bidirectional markdown editing with optional change callbacks.
 *
 * @author Maruf Bepary
 */
interface MarkdownViewProps {
  /** Optional unique identifier for the artifact; changes trigger re-parsing. */
  id?: string;
  /** Markdown content string to render and edit in BlockNote editor. */
  content: string;
  /** Optional callback fired 1000ms after content changes (debounced). Returns updated markdown. */
  onUpdate?: (content: string) => void;
}

/**
 * Parses a markdown string into BlockNote blocks via temporary headless editor.
 * Dynamically imports `@blocknote/core` to keep client bundles lean.
 *
 * @param content - Markdown string to parse
 * @returns Array of parsed BlockNote blocks
 * @author Maruf Bepary
 */
async function parseMarkdownToBlocks(content: string): Promise<Block[]> {
  const { BlockNoteEditor: BNEditor } = await import("@blocknote/core");
  const tempEditor = BNEditor.create();
  return tempEditor.tryParseMarkdownToBlocks(content);
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

  const { resolvedTheme } = useTheme();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="custom-scrollbar bg-background h-full w-full overflow-y-auto p-4">
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={() => {
          if (onUpdate) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
              try {
                const markdown = await editor.blocksToMarkdownLossy(
                  editor.document,
                );
                onUpdate(markdown);
              } catch (e) {
                logger.error("Failed to serialize markdown blocks", e);
              }
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
 * Re-parses markdown and increments editor revision when `id` or external content changes.
 * Remounts `BlockNoteEditor` on external updates so `useCreateBlockNote` receives new blocks.
 * Avoids re-parsing and remounting when `content` echoes back this editor's own edits.
 * Shows loading spinner while parsing; fires debounced updates on content changes.
 *
 * @param id - Optional artifact identifier; changes trigger markdown re-parsing
 * @param content - Markdown string to render and edit
 * @param onUpdate - Optional callback with debounced markdown output after edits
 * @returns BlockNote editor UI or loading spinner while parsing
 * @author Maruf Bepary
 */
export function MarkdownView({ id, content, onUpdate }: MarkdownViewProps) {
  const [parsedBlocks, setParsedBlocks] = useState<Block[] | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const lastEmittedContentRef = useRef<string | null>(null);
  const prevIdRef = useRef<string | undefined>(id);

  const handleUpdate = useCallback(
    (updatedMarkdown: string) => {
      lastEmittedContentRef.current = updatedMarkdown;
      onUpdate?.(updatedMarkdown);
    },
    [onUpdate],
  );

  useEffect(() => {
    const idChanged = prevIdRef.current !== id;
    if (idChanged) {
      prevIdRef.current = id;
      lastEmittedContentRef.current = null;
      setParsedBlocks(null);
    }

    if (!idChanged && content === lastEmittedContentRef.current) {
      return;
    }

    lastEmittedContentRef.current = null;

    let cancelled = false;

    async function parseMarkdown() {
      try {
        const blocks = await parseMarkdownToBlocks(content);
        if (!cancelled) {
          setParsedBlocks(blocks);
          setEditorRevision((rev) => rev + 1);
        }
      } catch (err) {
        logger.error("Failed to parse markdown", err);
        if (!cancelled) {
          setParsedBlocks([]);
          setEditorRevision((rev) => rev + 1);
        }
      }
    }

    parseMarkdown();
    return () => {
      cancelled = true;
    };
  }, [id, content]);

  if (!parsedBlocks) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <BlockNoteEditor
      key={`${id ?? "static"}-${editorRevision}`}
      blocks={parsedBlocks}
      onUpdate={handleUpdate}
    />
  );
}
