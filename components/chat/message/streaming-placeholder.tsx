"use client";

import { Bot, Loader2Icon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * A placeholder bubble shown when the assistant is thinking but hasn't
 * started streaming content yet.
 *
 */
export function StreamingPlaceholder() {
  return (
    <div className="fade-in slide-in-from-bottom-2 flex w-full animate-in flex-col gap-2 rounded-lg bg-muted/30 p-4 duration-300">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <Bot className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <div className="font-semibold text-foreground text-sm">Assistant</div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}
