"use client";

import { FilePlus, Files, FolderPlus } from "lucide-react";
import {
  type SkillDirectoryProps,
  SkillDirectoryShell,
} from "@/components/skill/skill-directory-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Represents skill directory sidebar props.
 *
 * @author Maruf Bepary
 */
export type SkillDirectorySidebarProps = SkillDirectoryProps;

/**
 * Sidebar component displaying the hierarchical directory structure of an Agent Skill.
 * Matches the grey header styling of the editor toolbar on the left with centered spacing.
 *
 * @author Maruf Bepary
 */
export function SkillDirectorySidebar(props: SkillDirectorySidebarProps) {
  return (
    <SkillDirectoryShell
      {...props}
      treeClassName="flex-1 space-y-0.5 overflow-y-auto p-2"
    >
      {({ openNewFileDialog, openNewFolderDialog, treeContent }) => (
        <Card className="border-border/70 bg-card flex flex-col gap-0 overflow-hidden rounded-lg border py-0 shadow-xs">
          {/* Directory header bar matching the gray toolbar of the editor with comfortable top/bottom padding */}
          <div className="border-border/70 bg-muted/60 dark:bg-muted/30 flex min-h-[50px] items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Files className="text-primary h-4 w-4" />
              <h3 className="text-sm font-semibold">Directory</h3>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-xs font-normal"
              >
                {props.files.length + 1}
              </Badge>
            </div>

            {/* Action buttons with Shadcn UI Tooltips */}
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-7 w-7"
                      onClick={() => openNewFileDialog("")}
                      title="New File"
                      aria-label="New File"
                    >
                      <FilePlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">New File</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-7 w-7"
                      onClick={() => openNewFolderDialog("")}
                      title="New Folder"
                      aria-label="New Folder"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">New Folder</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {treeContent}
        </Card>
      )}
    </SkillDirectoryShell>
  );
}
