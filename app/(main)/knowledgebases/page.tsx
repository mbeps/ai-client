"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { EmptyState } from "@/components/empty-state";

/**
 * Knowledge base grid page with text search, capacity bars, and recency-sorted listing.
 * Route: /knowledgebases. Reads knowledge bases from the Zustand store.
 *
 * @author Maruf Bepary
 */
export default function KnowledgebasesPage() {
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const [search, setSearch] = useState("");

  const filtered = knowledgebases.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.description.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container">
      <PageHeader
        icon={<Database className="h-8 w-8 text-primary" />}
        title="Knowledgebases"
        description="Manage your documents and global context."
        action={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Knowledgebase
          </Button>
        }
      />

      <div className="max-w-sm mb-6">
        <Input
          placeholder="Search knowledgebases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.length === 0 ? (
          <EmptyState message="No knowledge bases yet. Create one to attach documents to projects or assistants." />
        ) : (
          sorted.map((kb) => (
            <KnowledgebaseCard key={kb.id} knowledgebase={kb} />
          ))
        )}
      </div>
    </div>
  );
}
