"use client";

import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CanvasReopenButtonProps {
  onReopen: () => void;
}

/**
 * Floating button to reopen the canvas artifact panel when it is closed.
 */
export function CanvasReopenButton({ onReopen }: CanvasReopenButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-background/80 hover:bg-accent absolute top-3 right-3 z-30 size-7 cursor-pointer rounded-md shadow-xs backdrop-blur-xs transition-colors"
            onClick={onReopen}
            aria-label="Open canvas"
          >
            <PanelRight className="text-muted-foreground size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Open canvas</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
