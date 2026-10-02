"use client";

import { Ban, Check, ThumbsUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolApprovalButtonsProps {
  /** The staged verdict for this call, or `undefined` when undecided. */
  decision?: boolean;
  /** Whether a verdict has been staged for this call. */
  decided: boolean;
  /**
   * Whether the control is read-only. True once the batch has been sent, and
   * while a submission is in flight.
   */
  disabled: boolean;
  /** Whether this call's verdict may still be retracted. */
  canUndo: boolean;
  /** Stages a verdict for this call. */
  onDecide: (approved: boolean) => void;
  /** Retracts this call's staged verdict. */
  onUndo: () => void;
}

/**
 * Approve or deny one blocked tool call.
 *
 * The control is deliberately per call rather than per round: the buttons sit
 * on the row of the call they answer, so the link between a decision and its
 * tool stays visible. Deciding one call does not submit, because the AI SDK
 * rejects a partly answered round and destroys the turn; the round collects
 * every verdict and submits the batch once all are in.
 *
 * @param props.decision - The staged verdict, or `undefined` when undecided.
 * @param props.decided - Whether a verdict has been staged.
 * @param props.disabled - Whether the control is read-only.
 * @param props.canUndo - Whether the verdict may still be retracted.
 * @param props.onDecide - Stages a verdict.
 * @param props.onUndo - Retracts the staged verdict.
 * @author Maruf Bepary
 */
export function ToolApprovalButtons({
  decision,
  decided,
  disabled,
  canUndo,
  onDecide,
  onUndo,
}: ToolApprovalButtonsProps) {
  const approved = decision === true;

  if (decided) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Undo decision"
        disabled={!canUndo}
        onClick={onUndo}
        className="h-7 cursor-pointer gap-1 px-2 text-xs"
      >
        {approved ? (
          <Check className="size-3 text-success" />
        ) : (
          <Ban className="size-3 text-destructive" />
        )}
        {approved ? "Approved" : "Denied"}
        {canUndo && <Undo2 className="size-3 text-muted-foreground" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="Approve tool call"
        disabled={disabled}
        onClick={() => onDecide(true)}
        className="h-7 cursor-pointer gap-1 px-2 text-xs"
      >
        <ThumbsUp className="size-3" />
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="Deny tool call"
        disabled={disabled}
        onClick={() => onDecide(false)}
        className="h-7 cursor-pointer gap-1 px-2 text-xs"
      >
        <Ban className="size-3" />
        Deny
      </Button>
    </div>
  );
}
