"use client";

import { FilePlus, Files, FolderPlus } from "lucide-react";
import {
  type SkillDirectoryProps,
  SkillDirectoryShell,
} from "@/components/skill/skill-directory-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for the SkillDirectoryPicker component.
 *
 * @author Maruf Bepary
 */
export type SkillDirectoryPickerProps = SkillDirectoryProps;

/**
 * Directory section component for an Agent Skill rendered inside an Accordion.
 * Collapsed by default. Arrow is placed all the way to the right across the full width.
 * Actions (New File, New Folder) are located inside the accordion content above the tree view.
 *
 * @author Maruf Bepary
 */
export function SkillDirectoryPicker(props: SkillDirectoryPickerProps) {
  return (
    <div className="w-full">
      <SkillDirectoryShell
        {...props}
        treeClassName="border-border/50 bg-muted/20 space-y-0.5 border-t p-2"
      >
        {({ openNewFileDialog, openNewFolderDialog, treeContent }) => (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="directory"
              className="border-border/70 bg-card overflow-hidden rounded-lg border shadow-xs"
            >
              {/* Header Bar: Full-width trigger with Directory on left and Arrow all the way to right */}
              <div className="border-border/70 bg-muted/60 dark:bg-muted/30 w-full">
                <AccordionTrigger className="w-full items-center justify-between px-4 py-2.5 hover:no-underline [&>svg]:translate-y-0">
                  <div className="flex items-center gap-2">
                    <Files className="text-primary h-4 w-4" />
                    <span className="text-sm font-semibold">Directory</span>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-xs font-normal"
                    >
                      {props.files.length + 1}
                    </Badge>
                  </div>
                </AccordionTrigger>
              </div>

              {/* Accordion Content: Action bar at top, followed by Tree View */}
              <AccordionContent className="p-0">
                {/* Action Bar inside Accordion: New File & New Folder */}
                <div className="border-border/50 bg-muted/40 flex items-center justify-between border-t px-3 py-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Actions
                  </span>
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs font-medium"
                            onClick={() => openNewFileDialog("")}
                            title="New File"
                            aria-label="New File"
                          >
                            <FilePlus className="h-3.5 w-3.5" />
                            <span>New File</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">New File</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs font-medium"
                            onClick={() => openNewFolderDialog("")}
                            title="New Folder"
                            aria-label="New Folder"
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                            <span>New Folder</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">New Folder</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>

                {/* Tree View */}
                {treeContent}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </SkillDirectoryShell>
    </div>
  );
}
