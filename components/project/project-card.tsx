"use client";

import { FolderOpen, Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import type { Project } from "@/types/project/project";
import { ProjectOptions } from "./project-options";
import { EntityCard } from "@/components/shared/entity-card";

/**
 * Props for the ProjectCard component.
 *
 */
interface ProjectCardProps {
  /** The project entity containing id, name, description, and isPinned flag. */
  project: Project;
}

/**
 * Card displaying project name, description, folder icon, and pin indicator for projects listing page.
 * Clicking the card navigates to project detail page; options menu provides Pin/Unpin, Rename, and Delete actions.
 * Pin status is visually indicated with a small pin icon in the title row.
 *
 * @param props.project - Project entity with metadata for display and interaction.
 * @see ProjectOptions for menu actions including pin toggle.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <EntityCard
      icon={<FolderOpen className="h-5 w-5 text-primary" />}
      title={
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold leading-none truncate">
            {project.name}
          </h3>
          {project.isPinned && (
            <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
      }
      description={project.description}
      menu={<ProjectOptions project={project} />}
      onClick={() => router.push(ROUTES.PROJECTS.detail(project.id))}
    />
  );
}
