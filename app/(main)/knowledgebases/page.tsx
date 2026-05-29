"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { CreateKnowledgebaseDialog } from "./_components/create-knowledgebase-dialog";
import { listKnowledgebases, type KnowledgebaseWithCount } from "@/lib/actions/knowledgebases/list-knowledgebases";

export default function KnowledgebasesPage() {
  const [knowledgebases, setKnowledgebases] = useState<KnowledgebaseWithCount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const fetchKbs = useCallback(async () => {
    try {
      const data = await listKnowledgebases();
      startTransition(() => {
        setKnowledgebases(data);
      });
    } catch (error) {
      console.error("Failed to load knowledgebases:", error);
    }
  }, []);

  useEffect(() => {
    fetchKbs();
  }, [fetchKbs]);

  return (
    <>
      <ResourceListPage
        icon={<Database className="h-8 w-8 text-primary" />}
        title="Knowledgebases"
        description="Manage your documents and global context."
        items={knowledgebases}
        renderCard={(kb) => (
          <KnowledgebaseCard
            knowledgebase={{
              ...kb,
              description: kb.description ?? undefined,
            }}
            onAfterMutation={fetchKbs}
          />
        )}
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
        onSuccess={fetchKbs}
      />
    </>
  );
}
