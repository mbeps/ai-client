"use client";

import { CircleSlash, Loader2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModelTableBulkActions({
  isBusy,
  onBulkAction,
}: {
  isBusy: boolean;
  onBulkAction: (action: "enable" | "disable" | "delete") => void;
}) {
  return (
    <div className="bg-muted/50 flex items-center gap-1.5 rounded-lg border p-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isBusy}
        onClick={() => onBulkAction("enable")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="mr-1.5 h-3.5 w-3.5" />
        )}
        Enable
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isBusy}
        onClick={() => onBulkAction("disable")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CircleSlash className="mr-1.5 h-3.5 w-3.5" />
        )}
        Disable
      </Button>
      <div className="bg-border mx-1 h-4 w-[1px]" />
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
        disabled={isBusy}
        onClick={() => onBulkAction("delete")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Delete
      </Button>
    </div>
  );
}
