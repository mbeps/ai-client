"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { Database, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { CreateKnowledgebaseDialog } from "./_components/create-knowledgebase-dialog";
import {
  listKnowledgebases,
  type KnowledgebaseWithCount,
} from "@/lib/actions/knowledgebases/list-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/**
 * Knowledgebases page: Manage RAG document collections.
 *
 * Route: /knowledgebases. Displays searchable grid of knowledge bases (document collections).
 * Each KB shows document count and embedding model used. Validates that user has embedding
 * model configured before allowing creation. Protected route with create dialog for new KBs.
 *
 * @author Maruf Bepary
 */
export default function KnowledgebasesPage() {
  const router = useRouter();
  const { models } = useUserModels("embedding");
  const hasNoModels = models.length === 0;

  const [knowledgebases, setKnowledgebases] = useState<
    KnowledgebaseWithCount[]
  >([]);
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
      {hasNoModels && (
        <div className="page-container pb-0 mb-[-1rem]">
          <div className="flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs font-medium text-red-800 dark:text-red-200">
                No embedding models configured. Please set up a provider with
                embedding support to create knowledgebases.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] border-red-200 hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
              onClick={() => router.push(ROUTES.SETTINGS.PROVIDERS.path)}
            >
              Go to Settings
            </Button>
          </div>
        </div>
      )}
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
            disabled={hasNoModels}
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
