import { Database } from "lucide-react";
import { useMemo } from "react";
import { estimateToolContextTokens } from "@/lib/chat/estimate-tool-context-tokens";
import { formatTokens } from "@/lib/chat/format-tokens";

/**
 * Renders an estimated context usage token badge inside a TraceCollapsibleContent container.
 *
 * @author Maruf Bepary
 */
export function TraceContextUsage({
  args,
  result,
}: {
  args: unknown;
  result?: unknown;
}) {
  const tokens = useMemo(
    () => estimateToolContextTokens(args, result),
    [args, result],
  );

  return (
    <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-md border px-2.5 py-1 text-xs">
      <div className="text-muted-foreground flex items-center gap-1.5">
        <Database className="text-muted-foreground size-3.5" />
        <span className="text-[11px] font-medium">Context Usage</span>
      </div>
      <span className="text-foreground/80 font-mono text-[11px]">
        ~{formatTokens(tokens)} tokens
      </span>
    </div>
  );
}
