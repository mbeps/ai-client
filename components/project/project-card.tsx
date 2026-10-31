"use client";

import { FolderOpen } from "lucide-react";
import { ProjectOptions } from "@/components/project/project-options";
import { EntityCard } from "@/components/shared/entity-card";
import { ROUTES } from "@/config/routes";
import type { Project } from "@/types/project/project";

/**
 * Props for the ProjectCard component.
 *
 */
interface ProjectCardProps {
  /** The project entity containing id, name, and description. */
  project: Project;
}

/**
 * Card displaying project name, description, and folder icon for projects listing page.
 * Clicking the card navigates to project detail page; options menu provides Rename and Delete actions.
 *
 * @param props.project - Project entity with metadata for display and interaction.
 * @see ProjectOptions for menu actions.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <EntityCard
      href={ROUTES.PROJECTS.detail(project.id)}
      icon={<FolderOpen className="text-primary h-5 w-5" />}
      title={
        <h3 className="truncate leading-none font-semibold">{project.name}</h3>
      }
      description={project.description}
      menu={<ProjectOptions project={project} />}
    />
  );
}
