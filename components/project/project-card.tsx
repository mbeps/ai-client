"use client";

import { Card } from "@/components/ui/card";
import { FolderOpen, Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { Project } from "@/types/project";
import { ProjectOptions } from "./project-options";

/**
 * Props for the ProjectCard component.
 *
 * @author Maruf Bepary
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
 * @author Maruf Bepary
 */
export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[100px]"
      onClick={() => router.push(ROUTES.PROJECTS.detail(project.id))}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold leading-none truncate">
                {project.name}
              </h3>
              {project.isPinned && (
                <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ProjectOptions project={project} />
        </div>
      </div>
    </Card>
  );
}
