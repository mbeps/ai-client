"use client";

import {
  Check,
  ChevronDown,
  CircleCheck,
  Hand,
  MoreHorizontal,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateMcpToolApprovals } from "@/actions/mcp-servers/update-mcp-tool-approvals";
import type { DiscoveryResult } from "@/components/mcp/mcp-item-list";
import { McpItemList } from "@/components/mcp/mcp-item-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";
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
        const noneApproved =
          items.length === 0 ||
          items.every((t) => !autoApprovedTools.includes(t.name));
        const batchState = allApproved
          ? "always_allow"
          : noneApproved
            ? "needs_approval"
            : "custom";

        const triggerConfig = {
          always_allow: {
            icon: CircleCheck,
            label: "Always allow",
          },
          needs_approval: {
            icon: Hand,
            label: "Needs approval",
          },
          custom: {
            icon: MoreHorizontal,
            label: "Custom",
          },
        }[batchState];

        const TriggerIcon = triggerConfig.icon;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSaving || items.length === 0}
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
              >
                <TriggerIcon className="size-3.5" />
                <span>{triggerConfig.label}</span>
                <ChevronDown className="text-muted-foreground size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  if (!noneApproved) handleToggleAll(false, items);
                }}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  <Hand className="size-4" />
                  <span>Needs approval</span>
                </span>
                {batchState === "needs_approval" && (
                  <Check className="text-primary size-4" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!allApproved) handleToggleAll(true, items);
                }}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  <CircleCheck className="size-4" />
                  <span>Always allow</span>
                </span>
                {batchState === "always_allow" && (
                  <Check className="text-primary size-4" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                className="justify-between opacity-100"
              >
                <span className="flex items-center gap-2">
                  <MoreHorizontal className="size-4" />
                  <span>Custom</span>
                </span>
                {batchState === "custom" && (
                  <Check className="text-primary size-4" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
      renderItemActions={(tool, items) => {
        const isApproved = autoApprovedTools.includes(tool.name);
        return (
          <div
            role="radiogroup"
            aria-label={`Approval setting for ${tool.name}`}
            className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={isApproved}
              aria-label={`Always allow ${tool.name}`}
              disabled={isSaving}
              onClick={() => {
                if (!isApproved) handleToggleTool(tool.name, true, items);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
                isApproved
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CircleCheck className="size-3.5 shrink-0" />
              {isApproved && <span>Always allow</span>}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!isApproved}
              aria-label={`Needs approval ${tool.name}`}
              disabled={isSaving}
              onClick={() => {
                if (isApproved) handleToggleTool(tool.name, false, items);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
                !isApproved
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Hand className="size-3.5 shrink-0" />
              {!isApproved && <span>Needs approval</span>}
            </button>
          </div>
        );
      }}
    />
  );
}
