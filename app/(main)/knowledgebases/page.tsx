"use client";

import { useAppStore } from "@/lib/store";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";

/**
 * Knowledgebases listing page — client component displaying all user knowledgebases.
 * Features: searchable grid of knowledgebase cards, filter by name/description, create new knowledgebase.
 * Knowledgebases are document repositories attachable to projects or assistants.
 */
export default function KnowledgebasesPage() {
  const knowledgebases = useAppStore((state) => state.knowledgebases);

  return (
    <ResourceListPage
      icon={<Database className="h-8 w-8 text-primary" />}
      title="Knowledgebases"
      description="Manage your documents and global context."
      items={knowledgebases}
      renderCard={(kb) => <KnowledgebaseCard knowledgebase={kb} />}
      emptyStateMessage="No knowledge bases yet. Create one to attach documents to projects or assistants."
      searchPlaceholder="Search knowledgebases..."
      action={
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Knowledgebase
        </Button>
      }
      filterFn={(k, q) =>
        k.name.toLowerCase().includes(q.toLowerCase()) ||
        k.description.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
