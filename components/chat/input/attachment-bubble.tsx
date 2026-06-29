"use client";

import Image from "next/image";
import { X, FileText, FileSpreadsheet, ImageIcon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Props for AttachmentBubble component.
 *
 * @author Maruf Bepary
 */
interface AttachmentBubbleProps {
  /** Attachment object with type, name, and optional data URL for preview. */
  attachment: Attachment;
  /** Whether the current model supports vision/image analysis. */
  supportsVision: boolean;
  /** Callback fired when user clicks remove button; receives attachment ID. */
  onRemove: (id: string) => void;
}

/**
 * Renders a single attachment preview bubble in the chat input area.
 * Shows image thumbnails with vision-unsupported overlay if needed.
 * Displays document/spreadsheet icons for non-image attachments.
 * Includes inline remove button with icon.
 *
 * @param attachment - Attachment to display
 * @param supportsVision - Whether current model supports images
 * @param onRemove - Callback when user removes attachment
 * @returns Attachment preview bubble with icon/thumbnail and remove button
 * @author Maruf Bepary
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
