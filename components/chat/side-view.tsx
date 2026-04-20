"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./markdown-renderer";

/**
 * Props for the SideView component.
 *
 * @author Maruf Bepary
 */
interface SideViewProps {
  /** The Markdown or Mermaid content to render inside the panel. */
  content: string; // The markdown/HTML/Mermaid to render
  /** Callback invoked when the close button is clicked. */
  onClose: () => void;
  /** Controls whether the panel is visible. */
  isOpen: boolean;
}

/**
 * Collapsible right-hand artifact panel for the chat view.
 * Renders when `isOpen` is true and displays AI-generated content (typically
 * Mermaid diagrams) via `MarkdownRenderer`. On mobile it overlays the chat;
 * on medium+ screens it sits alongside it as a persistent panel.
 *
 * @param props.content - Markdown/Mermaid content to display.
 * @param props.onClose - Called when the user dismisses the panel.
 * @param props.isOpen - Whether the panel is currently visible.
 * @author Maruf Bepary
 */
export function SideView({ content, onClose, isOpen }: SideViewProps) {
  if (!isOpen) return null;

  return (
    <div className="w-full md:w-[400px] lg:w-[500px] h-full border-l bg-card flex flex-col shadow-xl md:shadow-none absolute right-0 top-0 z-50 md:relative">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Artifacts & Views</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-muted/20">
        {content ? (
          <MarkdownRenderer content={content} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Nothing to display here yet.
          </div>
        )}
      </div>
    </div>
  );
}
