"use client";

import Image from "next/image";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { getAttachmentUrl } from "@/lib/actions/attachments/get-attachment-url";
import type { Attachment } from "@/types/attachment";

interface AttachmentGalleryProps {
  attachments: Attachment[];
}

/**
 * Renders the attachment chip row for a user message.
 * Resolves presigned S3 URLs for attachments that have only a key (no dataUrl or url).
 * Images render as thumbnails with hover filename overlay;
 * documents/spreadsheets render as labelled download chips.
 *
 * @param props.attachments - Attachments to render.
 */
export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attachments || attachments.length === 0) return;

    const unresolvedAtts = attachments.filter(
      (att) => att.key && !att.dataUrl && !att.url,
    );
    if (unresolvedAtts.length === 0) return;

    let cancelled = false;
    Promise.all(
      unresolvedAtts.map(async (att) => {
        try {
          const data = await getAttachmentUrl(att.id);
          return { id: att.id, url: data.url as string };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const urls: Record<string, string> = {};
      for (const r of results) {
        if (r) urls[r.id] = r.url;
      }
      if (Object.keys(urls).length > 0) setResolvedUrls(urls);
    });

    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((att) => {
        const displayUrl = att.url || att.dataUrl || resolvedUrls[att.id];

        if (att.type === "image") {
          return displayUrl ? (
            <div key={att.id} className="relative group/att">
              <Image
                src={displayUrl}
                alt={att.name}
                width={256}
                height={192}
                className="max-h-48 max-w-64 rounded-lg border object-cover"
                unoptimized
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover/att:opacity-100 transition-opacity">
                {att.name}
              </span>
            </div>
          ) : (
            <div
              key={att.id}
              className="h-48 w-64 rounded-lg border bg-muted/50 animate-pulse"
            />
          );
        }

        const AttIcon = att.type === "spreadsheet" ? FileSpreadsheet : FileText;
        return displayUrl ? (
          <a
            key={att.id}
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs hover:bg-muted transition-colors"
          >
            <AttIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="max-w-[160px] truncate">{att.name}</span>
            <Download className="h-3 w-3 text-muted-foreground shrink-0" />
          </a>
        ) : (
          <div
            key={att.id}
            className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs animate-pulse"
          >
            <AttIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="max-w-[160px] truncate text-muted-foreground">
              {att.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
