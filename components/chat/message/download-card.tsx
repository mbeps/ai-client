"use client";

import {
  Archive,
  Download,
  FileAudio,
  FileCode,
  FileDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
} from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/utils/download-file";
import type {
  DownloadItem,
  DownloadItemType,
} from "@/types/download/download-item";

/**
 * Props for the DownloadCard component.
 */
interface DownloadCardProps {
  /** The downloadable item metadata to display and action. */
  item: DownloadItem;
  /** Optional creation timestamp to display. */
  createdAt?: Date | string;
  /** Optional extra classes. */
  className?: string;
}

/**
 * Human-readable labels for file categories.
 */
const TYPE_LABELS: Record<DownloadItemType, string> = {
  spreadsheet: "Spreadsheet",
  document: "Document",
  archive: "Archive",
  code: "Data / Code",
  image: "Image",
  audio: "Audio",
  video: "Video",
  file: "File",
};

/**
 * Formats byte size into human-readable string (KB, MB).
 */
function formatFileSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders an interactive button/card embedded in assistant responses that offers
 * downloadable material (e.g. spreadsheets, reports, storage links, archives).
 * Styled consistently with CanvasCard.
 *
 * @param props - Download item data, optional date, and custom className.
 * @returns An accessible card with icon, title, type/size label, and Download button.
 * @author Maruf Bepary
 */
export function DownloadCard({
  item,
  createdAt,
  className,
}: DownloadCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const typeLabel = TYPE_LABELS[item.type] ?? "File";
  const sizeLabel = formatFileSize(item.size);

  const formattedDate = useMemo(() => {
    const rawDate = createdAt || item.createdAt;
    if (!rawDate) return null;
    try {
      const date = typeof rawDate === "string" ? new Date(rawDate) : rawDate;
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return null;
    }
  }, [createdAt, item.createdAt]);

  const handleTriggerDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadFile(item.url, item.title);
    } catch {
      toast.error("Failed to download file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [item.url, item.title, isDownloading]);

  const handleCardClick = useCallback(() => {
    handleTriggerDownload();
  }, [handleTriggerDownload]);

  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleTriggerDownload();
    },
    [handleTriggerDownload],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTriggerDownload();
      }
    },
    [handleTriggerDownload],
  );

  const renderIcon = () => {
    switch (item.type) {
      case "spreadsheet":
        return <FileSpreadsheet className="size-5 text-emerald-500" />;
      case "document":
        return <FileText className="size-5 text-primary" />;
      case "archive":
        return <Archive className="size-5 text-amber-500" />;
      case "code":
        return <FileCode className="size-5 text-sky-500" />;
      case "image":
        return <FileImage className="size-5 text-rose-500" />;
      case "audio":
        return <FileAudio className="size-5 text-purple-500" />;
      case "video":
        return <FileVideo className="size-5 text-indigo-500" />;
      default:
        return <FileDown className="size-5 text-primary" />;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Download ${item.title}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group my-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 outline-none transition-all",
        "border-border/70 bg-card/70 hover:border-border hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/80 shadow-xs">
          {renderIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium text-foreground text-sm">
            {item.title}
          </h4>
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>{typeLabel}</span>
            {sizeLabel && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{sizeLabel}</span>
              </>
            )}
            {item.source && !sizeLabel && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{item.source}</span>
              </>
            )}
            {formattedDate && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{formattedDate}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={isDownloading}
        onClick={handleButtonClick}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 font-medium text-primary-foreground text-xs shadow-xs transition-all hover:bg-primary/90"
      >
        {isDownloading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>Downloading...</span>
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            <span>Download</span>
          </>
        )}
      </Button>
    </div>
  );
}
