"use client";

import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { CanvasCard } from "@/components/chat/message/canvas-card";
import { DownloadCard } from "@/components/chat/message/download-card";
import { downloadArtifact } from "@/lib/artifacts/download-artifact";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { DownloadItem } from "@/types/download/download-item";

export interface AssistantMessageBodyProps {
  messageArtifacts: ArtifactData[];
  messageDownloads: DownloadItem[];
  content: string;
  isCanvasOpen?: boolean;
  activeArtifactId?: string | null;
  onToggleArtifact?: (artifact: ArtifactData) => void;
  createdAt?: string | Date;
}

export function AssistantMessageBody({
  messageArtifacts,
  messageDownloads,
  content,
  isCanvasOpen,
  activeArtifactId,
  onToggleArtifact,
  createdAt,
}: AssistantMessageBodyProps) {
  return (
    <>
      {messageArtifacts.map((art) => (
        <CanvasCard
          key={art.id}
          artifact={art}
          isOpen={Boolean(isCanvasOpen && activeArtifactId === art.id)}
          onToggle={() => onToggleArtifact?.(art)}
          onDownload={() => downloadArtifact(art)}
          createdAt={createdAt}
        />
      ))}
      {messageDownloads.map((dl) => (
        <DownloadCard key={dl.id} item={dl} createdAt={createdAt} />
      ))}
      <MarkdownRenderer content={content} />
    </>
  );
}
