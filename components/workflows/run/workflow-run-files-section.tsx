"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { downloadFile } from "@/lib/utils/download-file";

/** Props for {@link WorkflowRunFilesSection}. */
export interface WorkflowRunFilesSectionProps {
  inputAttachmentIds?: string[];
  outputAttachmentIds?: string[];
  attachmentMeta: Record<string, { url: string; name: string }>;
}

function AttachmentDownloadList({
  ids,
  attachmentMeta,
  prefix,
  fallbackPrefix,
}: {
  ids: string[];
  attachmentMeta: Record<string, { url: string; name: string }>;
  prefix: string;
  fallbackPrefix: string;
}) {
  return (
    <div className="space-y-1.5">
      {ids.map((attId, index) => {
        const meta = attachmentMeta[attId];
        if (!meta) return null;
        return (
          <a
            key={`${prefix}-${attId}`}
            href={meta.url}
            download={meta.name}
            onClick={(e) => {
              e.preventDefault();
              downloadFile(meta.url, meta.name);
            }}
            className="hover:bg-accent flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium">
                {meta.name || `${fallbackPrefix} ${index + 1}`}
              </span>
            </div>
            <Download className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

/**
 * Displays downloadable input and output attachments attached to a workflow run.
 */
export function WorkflowRunFilesSection({
  inputAttachmentIds = [],
  outputAttachmentIds = [],
  attachmentMeta,
}: WorkflowRunFilesSectionProps) {
  if (inputAttachmentIds.length === 0 && outputAttachmentIds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {inputAttachmentIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Input Files
          </p>
          <AttachmentDownloadList
            ids={inputAttachmentIds}
            attachmentMeta={attachmentMeta}
            prefix="input"
            fallbackPrefix="Input"
          />
        </div>
      )}

      {outputAttachmentIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Output Files
          </p>
          <AttachmentDownloadList
            ids={outputAttachmentIds}
            attachmentMeta={attachmentMeta}
            prefix="output"
            fallbackPrefix="Output"
          />
        </div>
      )}
    </div>
  );
}
