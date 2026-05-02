"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Loader2Icon } from "lucide-react";

/**
 * A placeholder bubble shown when the assistant is thinking but hasn't
 * started streaming content yet.
 * 
 * @author Maruf Bepary
 */
export function StreamingPlaceholder() {
  return (
    <div className="flex flex-col gap-2 p-4 w-full bg-muted/30 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <Bot className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <div className="font-semibold text-sm text-foreground">Assistant</div>
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
