"use client";

import { Loader2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

/**
 * Represents project knowledgebase tab props.
 *
 * @author Maruf Bepary
 */
export interface ProjectKnowledgebaseTabProps {
  knowledgebases: Knowledgebase[];
  selectedKbId: string | null;
  onSelectKbId: (id: string | null) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
}

/**
 * Knowledge Base association tab for a Project.
 *
 * @author Maruf Bepary
 */
export function ProjectKnowledgebaseTab({
  knowledgebases,
  selectedKbId,
  onSelectKbId,
  onSave,
  isSaving = false,
  saveLabel = "Save Knowledge Base",
}: ProjectKnowledgebaseTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Knowledge Base</h3>
          <p className="text-muted-foreground text-sm">
            Attach a knowledge base to provide context to the AI in all chats
            within this project.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={ROUTES.KNOWLEDGEBASES.new}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Knowledgebase
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        <KnowledgebasePicker
          knowledgebases={knowledgebases}
          mode="single"
          selectedIds={new Set(selectedKbId ? [selectedKbId] : [])}
          onSelect={(ids) => onSelectKbId(Array.from(ids)[0] || null)}
          className="w-full"
          allowEmpty
          emptyLabel="Do not use a knowledge base (None)"
        />

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
