"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Info } from "lucide-react";
import { ResponsiveDetails } from "@/components/ui/responsive-details";
import type { ParsedMessageMetadata } from "@/types/message/metadata";

interface MessageDetailsProps {
  /** Timestamp when the message was created. */
  createdAt: Date;
  /** Parsed metadata from the assistant message. */
  metadata: ParsedMessageMetadata;
}

/**
 * Formats milliseconds into a human-readable duration string.
 * e.g. 1234 → "1.2s", 450 → "450ms", 65000 → "1m 5.0s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

/**
 * Detail row rendered inside the details dialog/drawer.
 * Only renders when `value` is truthy.
 */
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

/**
 * Clickable summary line + responsive dialog/drawer showing per-message details.
 * Renders a subtle trigger line with model name and date; clicking opens
 * a panel with token usage, duration, and finish reason.
 *
 * Only shown for assistant messages with valid metadata.
 * Rows with missing data (old messages) are simply omitted.
 *
 * @param props.createdAt - Message creation timestamp
 * @param props.metadata - Parsed message metadata with model, usage, timing
 */
export function MessageDetails({ createdAt, metadata }: MessageDetailsProps) {
  const { modelId, usage, finishReason, durationMs } = metadata;

  const formattedDate = useMemo(
    () => format(createdAt, "MMM d, yyyy 'at' h:mm a"),
    [createdAt],
  );

  const shortDate = useMemo(
    () => format(createdAt, "MMM d, yyyy h:mm a"),
    [createdAt],
  );

  // Nothing to show if there's no model or date
  if (!modelId && !createdAt) return null;

  const trigger = (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 py-0.5"
    >
      <Info className="h-3 w-3 shrink-0" />
      <span>
        {modelId && <span>{modelId}</span>}
        {modelId && createdAt && <span> · </span>}
        {createdAt && <span>{shortDate}</span>}
      </span>
    </button>
  );

  return (
    <ResponsiveDetails
      trigger={trigger}
      title="Response Details"
      description="Details about this AI response"
    >
      <div className="space-y-0">
        <DetailRow label="Model" value={modelId} />
        <DetailRow label="Date" value={formattedDate} />
        <DetailRow label="Finish Reason" value={finishReason} />
        {durationMs != null && (
          <DetailRow label="Duration" value={formatDuration(durationMs)} />
        )}
        {usage?.promptTokens != null && (
          <DetailRow
            label="Prompt Tokens"
            value={usage.promptTokens.toLocaleString()}
          />
        )}
        {usage?.completionTokens != null && (
          <DetailRow
            label="Completion Tokens"
            value={usage.completionTokens.toLocaleString()}
          />
        )}
        {usage?.totalTokens != null && (
          <DetailRow
            label="Total Tokens"
            value={usage.totalTokens.toLocaleString()}
          />
        )}
      </div>
    </ResponsiveDetails>
  );
}
