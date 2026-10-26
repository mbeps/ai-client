"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { INTERNAL_TOOL_IDS } from "@/config/tools";

/**
 * Represents internal tools section props.
 *
 * @author Maruf Bepary
 */
interface InternalToolsSectionProps {
  search: string;
  isExpanded: boolean;
  selectedTools: Set<string>;
  onToggleExpand: () => void;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
}

/**
 * Renders the internal tool item component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function InternalToolItem({
  checked,
  onToggle,
  title,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className="group hover:bg-accent flex cursor-pointer items-start gap-2 rounded-md p-2 transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{title}</span>
        <span className="text-muted-foreground line-clamp-2 text-[10px]">
          {description}
        </span>
      </div>
    </label>
  );
}

/**
 * Collapsible section for toggling internal platform tools (artifacts, memory).
 *
 * @author Maruf Bepary
 */
export function InternalToolsSection({
  search,
  isExpanded,
  selectedTools,
  onToggleExpand,
  onToggleTool,
  onBulkSelect,
}: InternalToolsSectionProps) {
  if (
    search &&
    !"artifacts canvas manage_artifact memory save_memory".includes(
      search.toLowerCase(),
    )
  ) {
    return null;
  }

  const isArtifactSelected = selectedTools.has(
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
  );
  const isMemorySelected = selectedTools.has(INTERNAL_TOOL_IDS.MANAGE_MEMORY);
  const count = (isArtifactSelected ? 1 : 0) + (isMemorySelected ? 1 : 0);
  const isAllInternalSelected = isArtifactSelected && isMemorySelected;

  return (
    <div className="border-primary/20 flex flex-col overflow-hidden rounded-lg border">
      <div
        className="bg-primary/5 hover:bg-primary/10 flex shrink-0 cursor-pointer items-center justify-between p-3 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          {isExpanded || search.length > 0 ? (
            <ChevronDown className="text-primary h-4 w-4" />
          ) : (
            <ChevronRight className="text-primary h-4 w-4" />
          )}
          <span className="text-primary font-medium">Internal Tools</span>
          {count > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {count} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              onBulkSelect(
                "internal",
                ["manage_artifact", "manage_memory"],
                !isAllInternalSelected,
              );
            }}
          >
            <Checkbox
              checked={isAllInternalSelected}
              aria-label="Select all internal tools"
              className="h-4 w-4"
            />
          </div>
        </div>
      </div>

      {(isExpanded || search.length > 0) && (
        <div className="border-primary/20 bg-card/50 space-y-4 border-t p-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <InternalToolItem
                  checked={isArtifactSelected}
                  onToggle={() => onToggleTool("internal", "manage_artifact")}
                  title="Artifacts / Canvas"
                  description="Allows the AI to generate interactive Markdown, Spreadsheets, HTML UI, and Mermaid diagrams in a side panel."
                />
                <InternalToolItem
                  checked={isMemorySelected}
                  onToggle={() => onToggleTool("internal", "manage_memory")}
                  title="Memory"
                  description="Allows the AI to remember your preferences and facts across conversations."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
