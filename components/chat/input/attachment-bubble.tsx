"use client";

import Image from "next/image";
import { X, FileText, FileSpreadsheet, ImageIcon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/attachment/attachment";

interface AttachmentBubbleProps {
  attachment: Attachment;
  supportsVision: boolean;
  onRemove: (id: string) => void;
}

/**
 * Renders a single attachment preview bubble within the chat input.
 * Handles image previews (with optional vision-unsupported indicator),
 * document icons, and spreadsheet icons, plus a remove button.
 */
export function AttachmentBubble({
  attachment,
  supportsVision,
  onRemove,
}: AttachmentBubbleProps) {
  const isImageUnsupported = attachment.type === "image" && !supportsVision;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs transition-opacity duration-200",
        isImageUnsupported && "opacity-50 grayscale",
      )}
    >
      {attachment.type === "image" ? (
        <div className="relative">
          {attachment.dataUrl ? (
            <Image
              src={attachment.dataUrl}
              alt={attachment.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded object-cover"
              unoptimized
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {isImageUnsupported && (
            <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm">
              <Zap className="h-2 w-2" />
            </div>
          )}
        </div>
      ) : attachment.type === "spreadsheet" ? (
        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex flex-col">
        <span className="max-w-[120px] truncate">{attachment.name}</span>
        {isImageUnsupported && (
          <span className="text-[10px] text-destructive font-medium">
            Unsupported
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
