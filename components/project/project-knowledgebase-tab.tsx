"use client";

import { Loader2, Save } from "lucide-react";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { Button } from "@/components/ui/button";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

export interface ProjectKnowledgebaseTabProps {
  knowledgebases: Knowledgebase[];
  selectedKbId: string | null;
  onSelectKbId: (id: string | null) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
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
}: ProjectKnowledgebaseTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Knowledge Base</h3>
        <p className="text-muted-foreground text-sm">
          Attach a knowledge base to provide context to the AI in all chats
          within this project.
        </p>
      </div>

      <div className="space-y-4">
        <KnowledgebasePicker
          knowledgebases={knowledgebases}
          mode="single"
          selectedIds={new Set(selectedKbId ? [selectedKbId] : [])}
          onSelect={(ids) => onSelectKbId(Array.from(ids)[0] || null)}
          className="max-w-2xl"
          allowEmpty
          emptyLabel="Do not use a knowledge base (None)"
        />

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Knowledge Base
        </Button>
      </div>
    </div>
  );
}
export default ProjectKnowledgebaseTab;
