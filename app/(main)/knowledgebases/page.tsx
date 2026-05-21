"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { CreateKnowledgebaseDialog } from "./_components/create-knowledgebase-dialog";

export default function KnowledgebasesPage() {
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const loadKnowledgebases = useAppStore((state) => state.loadKnowledgebases);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (knowledgebases.length === 0) {
      loadKnowledgebases().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ResourceListPage
        icon={<Database className="h-8 w-8 text-primary" />}
        title="Knowledgebases"
        description="Manage your documents and global context."
        items={knowledgebases}
        renderCard={(kb) => <KnowledgebaseCard knowledgebase={kb} />}
        emptyStateMessage="No knowledge bases yet. Create one to attach documents to projects or assistants."
        searchPlaceholder="Search knowledgebases..."
        action={
          <Button
            className="w-full md:w-auto"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Knowledgebase
          </Button>
        }
        filterFn={(k, q) =>
          k.name.toLowerCase().includes(q.toLowerCase()) ||
          (k.description?.toLowerCase().includes(q.toLowerCase()) ?? false)
        }
      />
      <CreateKnowledgebaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
