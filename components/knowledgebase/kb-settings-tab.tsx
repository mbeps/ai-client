"use client";

import {
  AlertTriangle,
  Database,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

export interface KbSettingsTabProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  embeddingModelLabel: string;
  kb: KnowledgebaseRow;
  onReindex: () => Promise<void> | void;
}

/**
 * Settings tab for a Knowledge Base: details editing and embedding configuration.
 *
 * @author Maruf Bepary
 */
export function KbSettingsTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onSave,
  isSaving = false,
  embeddingModelLabel,
  kb,
  onReindex,
}: KbSettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Knowledge Base Details</h3>
        <p className="text-muted-foreground text-sm">
          Manage the knowledge base name and description.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <label className="font-medium text-sm">Name</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Knowledge base name"
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium text-sm">Description</label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe what this knowledge base contains..."
            rows={4}
          />
        </div>
        <Button
          onClick={onSave}
          disabled={isSaving || !name.trim()}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="border-t pt-6">
        <div className="mb-4 space-y-1">
          <h3 className="font-semibold text-foreground text-lg">
            Embedding Configuration
          </h3>
          <p className="text-muted-foreground text-sm">
            Current embedding model and index status.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Global Embedding Model
            </div>
            <div className="flex items-center gap-2 font-medium text-sm">
              <Database className="h-4 w-4 text-primary" />
              {embeddingModelLabel}
            </div>
          </div>

          {kb.indexStatus === "stale" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-xs dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-blue-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Re-index required
              </div>
              <p className="mt-1.5 text-amber-600 leading-relaxed dark:text-amber-400">
                Your embedding configuration has changed. Documents must be
                re-indexed to ensure search accuracy.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-8 border-amber-200 hover:bg-amber-100 dark:border-amber-900/50 dark:hover:bg-amber-100/10"
                onClick={onReindex}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Re-index Now
              </Button>
            </div>
          )}

          {kb.indexStatus === "indexing" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-700 text-xs dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                Indexing in progress
              </div>
              <p className="mt-1.5 text-blue-600 leading-relaxed dark:text-blue-400">
                Updating your search index. This may take a few minutes
                depending on document size.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default KbSettingsTab;
