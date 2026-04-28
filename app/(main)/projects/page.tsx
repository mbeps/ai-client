"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project/project-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { CreateProjectDialog } from "./_components/create-project-dialog";

/**
 * Projects list page for managing workspaces and context boundaries.
 * Route: /projects. Searchable grid with create dialog to define shared system prompts.
 * Protected route — requires active authentication. Loads projects on mount via Zustand.
 *
 * @returns Searchable list of project cards with creation and management options.
 * @see HomePage to create new chats within a selected project.
 * @author Maruf Bepary
 */
export default function ProjectsPage() {
  const projects = useAppStore((state) => state.projects);
  const loadProjects = useAppStore((state) => state.loadProjects);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <ResourceListPage
        icon={<FolderOpen className="h-8 w-8 text-primary" />}
        title="Projects"
        description="Manage your workspaces and context boundaries."
        items={projects}
        renderCard={(project) => <ProjectCard project={project} />}
        emptyStateMessage="No projects yet. Create one to group chats with a shared system prompt."
        searchPlaceholder="Search projects..."
        onMount={loadProjects}
        action={
          <Button
            onClick={() => setDialogOpen(true)}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        }
        filterFn={(p, q) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.description.toLowerCase().includes(q.toLowerCase())
        }
      />
      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
