"use client";

import { Wrench } from "lucide-react";
import { McpItemList } from "@/components/mcp/mcp-item-list";
import type { DiscoveryResult } from "@/components/mcp/mcp-item-list";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { McpServer } from "@/types/mcp/mcp-server";
import { Badge } from "@/components/ui/badge";

/**
 * Props for ToolList component.
 *
 * @interface ToolListProps
 */
export interface ToolListProps {
  /**
   * The MCP server configuration to discover tools from.
   * Used to trigger discovery via server.id.
   */
  server: McpServer;
}

/**
 * Fetches tools from the discovery result of an MCP server.
 *
 * @param result - Discovery result containing tools and resources
 * @returns Array of discovered tools
 */
function fetchTools(result: DiscoveryResult): DiscoveredTool[] {
  return result.tools;
}

/**
 * Generates a unique key for a discovered tool based on its name.
 *
 * @param tool - The discovered tool object
 * @returns Unique key string for the tool
 */
function getToolKey(tool: DiscoveredTool): string {
  return tool.name;
}

/**
 * Generates a display label for a discovered tool based on its name.
 *
 * @param tool - The discovered tool object
 * @returns Display label string for the tool
 */
function getToolLabel(tool: DiscoveredTool): string {
  return tool.name;
}

/**
 * Renders the detailed content for a discovered tool in the accordion view.
 * Displays the tool description and structured parameter schema with type information.
 * Shows required parameter indicators and supports optional descriptions per parameter.
 *
 * @param tool - The discovered tool to render content for
 * @returns JSX fragment with tool description and parameters display
 * @author Maruf Bepary
 */
function renderToolContent(tool: DiscoveredTool) {
  return (
    <>
      {tool.description && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground">
            Description
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {tool.description}
          </p>
        </div>
      )}

      {tool.inputSchema &&
        Object.keys(
          (tool.inputSchema.properties as Record<string, unknown>) || {},
        ).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Parameters
            </h4>
            <div className="grid gap-2">
              {Object.entries(
                (tool.inputSchema.properties as Record<string, any>) || {},
              ).map(([propName, prop]: [string, any]) => (
                <div
                  key={propName}
                  className="flex flex-col gap-1 p-2 rounded-md bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-bold text-primary px-1.5 py-0.5 rounded">
                      {propName}
                    </code>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {prop.type}
                      {(tool.inputSchema.required as string[])?.includes(
                        propName,
                      ) && <span className="ml-1 text-destructive">*</span>}
                    </Badge>
                  </div>
                  {prop.description && (
                    <p className="text-xs text-muted-foreground italic">
                      {prop.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
    </>
  );
}

/**
 * Displays tools discovered from an MCP server in an expandable accordion.
 * Auto-fetches tools on mount; supports manual refresh. Shows description and parameters per tool.
 * Handles loading, error, and empty states with retry capability.
 * Displays parameter types and required indicators for each tool.
 *
 * @param props - Component props
 * @param props.server - MCP server to discover tools from; discovery is keyed by server.id
 * @see {@link ResourceList} for displaying server resources
 * @see {@link ServerCard} for server overview
 * @see {@link McpItemList} for generic item list implementation
 * @author Maruf Bepary
 */
export function ToolList({ server }: ToolListProps) {
  return (
    <McpItemList<DiscoveredTool>
      server={server}
      icon={Wrench}
      fetchItems={fetchTools}
      getItemKey={getToolKey}
      getItemLabel={getToolLabel}
      itemKind="tool"
      emptyMessage="No tools discovered from this server."
      renderContent={renderToolContent}
    />
  );
}
