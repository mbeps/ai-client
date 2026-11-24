"use client";

import { AlertCircle } from "lucide-react";
import { DynamicUIBlock } from "@/components/chat/generative-ui/dynamic-ui-block";

/**
 * Props for the UiView artifact component.
 */
interface UiViewProps {
  content: string;
}

/**
 * Renders declarative interactive UI artifacts inside the Canvas side panel
 * using in-DOM Shadcn components (no iframe).
 *
 * @param props.content - JSON/JSONL UI spec string to render.
 * @returns Scrollable interactive UI view or an empty-state placeholder.
 */
export function UiView({ content }: UiViewProps) {
  if (!content.trim()) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertCircle className="h-8 w-8" />
        <p>No interactive UI content to display.</p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar bg-background h-full w-full overflow-y-auto p-6">
      <DynamicUIBlock rawSpec={content} className="my-0" />
    </div>
  );
}
