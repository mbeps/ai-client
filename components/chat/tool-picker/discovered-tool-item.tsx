"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";

/**
 * Represents discovered tool item props.
 *
 * @author Maruf Bepary
 */
interface DiscoveredToolItemProps {
  serverId: string;
  tool: DiscoveredTool;
  isChecked: boolean;
  onToggle: (serverId: string, toolName: string) => void;
}

/**
 * Renders an individual discovered MCP tool with checkbox and description.
 *
 * @author Maruf Bepary
 */
export function DiscoveredToolItem({
  serverId,
  tool,
  isChecked,
  onToggle,
}: DiscoveredToolItemProps) {
  return (
    <label className="group hover:bg-accent flex cursor-pointer items-start gap-2 rounded-md p-2 transition-colors">
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => onToggle(serverId, tool.name)}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{tool.name}</span>
        {tool.description && (
          <span className="text-muted-foreground line-clamp-1 text-[10px]">
            {tool.description}
          </span>
        )}
      </div>
    </label>
  );
}
