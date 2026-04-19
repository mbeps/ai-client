"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AssistantCard } from "@/components/assistant/assistant-card";
import { EmptyState } from "@/components/empty-state";

/**
 * Assistant grid page with text search and recency-sorted listing.
 * Route: /assistants. Reads assistants from the Zustand store.
 *
 * @author Maruf Bepary
 */
export default function AssistantsPage() {
  const assistants = useAppStore((state) => state.assistants);
  const [search, setSearch] = useState("");

  const filtered = assistants.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container">
      <PageHeader
        icon={<Bot className="h-8 w-8 text-primary" />}
        title="Assistants"
        description="Custom AI personas tailored for specific tasks."
        action={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Assistant
          </Button>
        }
      />

      <div className="max-w-sm mb-6">
        <Input
          placeholder="Search assistants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.length === 0 ? (
          <EmptyState message="No assistants yet. Create one to define a custom AI persona." />
        ) : (
          sorted.map((assistant) => (
            <AssistantCard key={assistant.id} assistant={assistant} />
          ))
        )}
      </div>
    </div>
  );
}
