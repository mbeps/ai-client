"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project/project-card";

/**
 * Project grid page with text search and recency-sorted listing.
 * Route: /projects. Reads projects from the Zustand store.
 *
 * @author Maruf Bepary
 */
export default function ProjectsPage() {
  const projects = useAppStore((state) => state.projects);
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  // Sort by date only, pinned is removed
  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container">
      <PageHeader
        icon={<FolderOpen className="h-8 w-8 text-primary" />}
        title="Projects"
        description="Manage your workspaces and context boundaries."
        action={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        }
      />

      <div className="max-w-sm mb-6">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
