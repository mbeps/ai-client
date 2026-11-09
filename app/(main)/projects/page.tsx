"use client";

import { FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import { ProjectCard } from "@/components/project/project-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Projects list page for managing workspaces and context boundaries.
 * Route: /projects. Searchable grid linking to the dedicated project creator.
 * Protected route — requires active authentication. Loads projects on mount via Zustand.
 *
 * @returns Searchable list of project cards with creation and management options.
 * @see HomePage to create new chats within a selected project.
 * @author Maruf Bepary
 */
export default function ProjectsPage() {
  const projects = useAppStore((state) => state.projects);
  const loadProjects = useAppStore((state) => state.loadProjects);

  return (
    <ResourceListPage
      icon={<FolderOpen className="text-primary h-8 w-8" />}
      title="Projects"
      description="Manage your workspaces and context boundaries."
      items={projects}
      renderCard={(project) => <ProjectCard project={project} />}
      emptyStateMessage="No projects yet. Create one to group chats with a shared system prompt."
      searchPlaceholder="Search projects..."
      onMount={loadProjects}
      action={
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.PROJECTS.new}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      }
      filterFn={(p, q) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.description?.toLowerCase().includes(q.toLowerCase()) ?? false)
      }
    />
  );
}
