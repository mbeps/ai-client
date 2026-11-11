"use client";

import { Database, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  type KnowledgebaseWithCount,
  listKnowledgebases,
} from "@/actions/knowledgebases/list-knowledgebases";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useUserModels } from "@/hooks/use-user-models";
import { logger } from "@/lib/logger";

/**
 * Knowledgebases page: Manage RAG document collections.
 *
 * Route: /knowledgebases. Displays searchable grid of knowledge bases (document collections).
 * Each KB shows document count and embedding model used. Links to the dedicated creation page.
 *
 * @author Maruf Bepary
 */
export default function KnowledgebasesPage() {
  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const hasNoModels = !isModelsLoading && models.length === 0;

  const [knowledgebases, setKnowledgebases] = useState<
    KnowledgebaseWithCount[]
  >([]);
  const [, startTransition] = useTransition();

  const fetchKbs = useCallback(async () => {
    try {
      const res = await listKnowledgebases();
      if (res.ok) {
        startTransition(() => {
          setKnowledgebases(res.value);
        });
      } else {
        logger.error("Failed to load knowledgebases", res.error);
      }
    } catch (error) {
      logger.error("Failed to load knowledgebases", error);
    }
  }, []);

  useEffect(() => {
    fetchKbs();
  }, [fetchKbs]);

  return (
    <ResourceListPage
      banner={
        hasNoModels ? (
          <NoModelsAlertBanner message="No embedding models configured. Please set up a provider with embedding support to create knowledgebases." />
        ) : undefined
      }
      icon={<Database className="text-primary h-8 w-8" />}
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
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.KNOWLEDGEBASES.new}>
            <Plus className="mr-2 h-4 w-4" />
            New Knowledgebase
          </Link>
        </Button>
      }
      filterFn={(k, q) =>
        k.name.toLowerCase().includes(q.toLowerCase()) ||
        (k.description?.toLowerCase().includes(q.toLowerCase()) ?? false)
      }
    />
  );
}
