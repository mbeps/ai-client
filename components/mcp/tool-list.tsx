"use client";

import { ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateMcpToolApprovals } from "@/actions/mcp-servers/update-mcp-tool-approvals";
import type { DiscoveryResult } from "@/components/mcp/mcp-item-list";
import { McpItemList } from "@/components/mcp/mcp-item-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store/use-app-store";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { McpServer } from "@/types/mcp/mcp-server";

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

function fetchTools(result: DiscoveryResult): DiscoveredTool[] {
  return result.tools;
}

function getToolKey(tool: DiscoveredTool): string {
  return tool.name;
}

function getToolLabel(tool: DiscoveredTool): string {
  return tool.name;
}

function renderToolContent(tool: DiscoveredTool) {
  return (
    <>
      {tool.description && (
        <div className="space-y-1">
          <h4 className="text-muted-foreground text-xs font-semibold">
            Description
          </h4>
          <p className="text-foreground/80 text-sm leading-relaxed">
            {tool.description}
          </p>
        </div>
      )}

      {tool.inputSchema &&
        Object.keys(
          (tool.inputSchema.properties as Record<string, unknown>) || {},
        ).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-muted-foreground text-xs font-semibold">
              Parameters
            </h4>
            <div className="grid gap-2">
              {Object.entries(
                (tool.inputSchema.properties as Record<string, any>) || {},
              ).map(([propName, prop]: [string, any]) => (
                <div
                  key={propName}
                  className="border-border/50 bg-muted/50 flex flex-col gap-1 rounded-md border p-2"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-primary rounded px-1.5 py-0.5 text-xs font-bold">
                      {propName}
                    </code>
                    <Badge variant="outline" className="h-4 text-[10px]">
                      {prop.type}
                      {(tool.inputSchema.required as string[])?.includes(
                        propName,
                      ) && <span className="text-destructive ml-1">*</span>}
                    </Badge>
                  </div>
                  {prop.description && (
                    <p className="text-muted-foreground text-xs italic">
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
 * Displays tools discovered from an MCP server in an expandable accordion,
 * with per-tool and bulk execution approval controls backed by
 * {@link updateMcpToolApprovals}.
 *
 * @param props - Component props
 * @param props.server - MCP server to discover tools from
 * @author Maruf Bepary
 */
export function ToolList({ server }: ToolListProps) {
  const loadMcpServers = useAppStore((s) => s.loadMcpServers);
  const [autoApprovedTools, setAutoApprovedTools] = useState<string[]>(
    server.autoApprovedTools ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAutoApprovedTools(server.autoApprovedTools ?? []);
  }, [server.autoApprovedTools]);

  const persistApprovals = useCallback(
    async (nextTools: string[], discoveredTools: DiscoveredTool[]) => {
      const discoveredNames = new Set(discoveredTools.map((t) => t.name));
      const pruned = nextTools.filter((name) => discoveredNames.has(name));
      const previous = autoApprovedTools;

      setAutoApprovedTools(pruned);
      setIsSaving(true);
      try {
        const res = await updateMcpToolApprovals({
          serverId: server.id,
          autoApprovedTools: pruned,
        });
        if (!res.ok) {
          setAutoApprovedTools(previous);
          toast.error(res.error.message);
          return;
        }
        setAutoApprovedTools(res.value.autoApprovedTools);
        await loadMcpServers();
        toast.success("Tool approval settings updated");
      } finally {
        setIsSaving(false);
      }
    },
    [autoApprovedTools, loadMcpServers, server.id],
  );

  const handleToggleTool = useCallback(
    (
      toolName: string,
      approved: boolean,
      discoveredTools: DiscoveredTool[],
    ) => {
      const nextTools = approved
        ? [...autoApprovedTools, toolName]
        : autoApprovedTools.filter((name) => name !== toolName);
      void persistApprovals(nextTools, discoveredTools);
    },
    [autoApprovedTools, persistApprovals],
  );

  const handleToggleAll = useCallback(
    (approveAll: boolean, discoveredTools: DiscoveredTool[]) => {
      const nextTools = approveAll ? discoveredTools.map((t) => t.name) : [];
      void persistApprovals(nextTools, discoveredTools);
    },
    [persistApprovals],
  );

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
      headerActions={(items) => {
        const allApproved =
          items.length > 0 &&
          items.every((t) => autoApprovedTools.includes(t.name));
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => handleToggleAll(!allApproved, items)}
            className="h-8 text-xs"
          >
            {allApproved ? "Require approval for all" : "Auto-approve all"}
          </Button>
        );
      }}
      renderItemActions={(tool, items) => {
        const isApproved = autoApprovedTools.includes(tool.name);
        return (
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground hidden items-center gap-1 text-xs sm:inline-flex">
              {isApproved ? (
                <>
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Auto-approved</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Requires approval</span>
                </>
              )}
            </span>
            <Switch
              checked={isApproved}
              disabled={isSaving}
              aria-label={`Auto-approve ${tool.name}`}
              onCheckedChange={(checked) =>
                handleToggleTool(tool.name, checked, items)
              }
            />
          </div>
        );
      }}
    />
  );
}
