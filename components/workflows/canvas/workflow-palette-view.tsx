"use client";

import {
  ArrowUpRight,
  Bot,
  Filter,
  GitBranch,
  Globe,
  type LucideIcon,
  Play,
  Repeat,
  Search,
  Sparkles,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";
import type { WorkflowNodeType } from "@/types/workflows/workflow";

interface PaletteNodeItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}

const AI_AGENT_ITEM: PaletteNodeItem = {
  type: "ai_step",
  label: "AI Agent",
  description: "Execute prompt with tools & structured output",
  icon: Sparkles,
};

const FLOW_CONTROL_ITEMS: PaletteNodeItem[] = [
  {
    type: "if_condition",
    label: "Condition",
    description: "Branch True / False via rules or LLM",
    icon: GitBranch,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    type: "loop",
    label: "Loop",
    description: "Iterate over an array or fixed count",
    icon: Repeat,
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  {
    type: "filter",
    label: "Filter",
    description: "Filter array items via rules or LLM",
    icon: Filter,
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
];

const TRIGGER_ACTION_ITEMS: PaletteNodeItem[] = [
  {
    type: "manual_trigger",
    label: "Manual Trigger",
    description: "Run manually with optional input files",
    icon: Play,
  },
  {
    type: "webhook_trigger",
    label: "Webhook Trigger",
    description: "Start via authenticated HTTP POST",
    icon: Webhook,
  },
  {
    type: "http_request",
    label: "HTTP Request",
    description: "Call an external REST API endpoint",
    icon: Globe,
  },
];

const DEFAULT_OPEN_GROUPS = [
  "flow-control",
  "triggers-actions",
  "existing-agents",
];

function matchesQuery(
  query: string,
  ...fields: Array<string | undefined>
): boolean {
  if (!query) return true;
  return fields.some((field) => field?.toLowerCase().includes(query));
}

/** Props for {@link WorkflowPaletteView}. */
export interface WorkflowPaletteViewProps {
  agents?: Agent[];
  onAddNode: (type: WorkflowNodeType) => void;
  onAddAgentNode: (agent: Agent) => void;
}

function PaletteItemButton({
  item,
  onSelect,
}: {
  item: PaletteNodeItem;
  onSelect: (type: WorkflowNodeType) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.type)}
      className="hover:bg-accent flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors"
    >
      <div className="bg-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
        <Icon className={cn("text-primary h-4 w-4", item.iconClassName)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight font-medium">{item.label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
          {item.description}
        </p>
      </div>
    </button>
  );
}

/**
 * Searchable, grouped node and agent palette for the docked Workflow Studio right panel.
 */
export function WorkflowPaletteView({
  agents = [],
  onAddNode,
  onAddAgentNode,
}: WorkflowPaletteViewProps) {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  const showAiAgent = matchesQuery(
    query,
    AI_AGENT_ITEM.label,
    AI_AGENT_ITEM.description,
    "ai step",
  );

  const filteredFlowControl = useMemo(
    () =>
      FLOW_CONTROL_ITEMS.filter((item) =>
        matchesQuery(query, item.label, item.description),
      ),
    [query],
  );

  const filteredTriggersActions = useMemo(
    () =>
      TRIGGER_ACTION_ITEMS.filter((item) =>
        matchesQuery(query, item.label, item.description),
      ),
    [query],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter((agent) =>
        matchesQuery(query, agent.name, agent.description),
      ),
    [agents, query],
  );

  const matchingGroupIds = useMemo(() => {
    const ids: string[] = [];
    if (filteredFlowControl.length > 0) ids.push("flow-control");
    if (filteredTriggersActions.length > 0) ids.push("triggers-actions");
    if (filteredAgents.length > 0) ids.push("existing-agents");
    return ids;
  }, [
    filteredFlowControl.length,
    filteredTriggersActions.length,
    filteredAgents.length,
  ]);

  const hasAnyMatch =
    showAiAgent ||
    filteredFlowControl.length > 0 ||
    filteredTriggersActions.length > 0 ||
    filteredAgents.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes & agents..."
            aria-label="Search nodes and agents"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {isSearching && !hasAnyMatch ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            No matching nodes or agents
          </p>
        ) : (
          <>
            {showAiAgent && (
              <button
                type="button"
                onClick={() => onAddNode("ai_step")}
                className="border-border bg-card hover:bg-accent/60 flex w-full items-start gap-3 rounded-xl border p-3 text-left shadow-xs transition-colors"
              >
                <div className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{AI_AGENT_ITEM.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {AI_AGENT_ITEM.description}
                  </p>
                </div>
              </button>
            )}

            <Accordion
              type="multiple"
              value={isSearching ? matchingGroupIds : openGroups}
              onValueChange={setOpenGroups}
              className="space-y-1"
            >
              {(!isSearching || filteredFlowControl.length > 0) && (
                <AccordionItem value="flow-control" className="border-b-0">
                  <AccordionTrigger className="text-muted-foreground py-2 text-xs font-semibold tracking-wide uppercase hover:no-underline">
                    Flow control
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    {filteredFlowControl.map((item) => (
                      <PaletteItemButton
                        key={item.type}
                        item={item}
                        onSelect={onAddNode}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {(!isSearching || filteredTriggersActions.length > 0) && (
                <AccordionItem value="triggers-actions" className="border-b-0">
                  <AccordionTrigger className="text-muted-foreground py-2 text-xs font-semibold tracking-wide uppercase hover:no-underline">
                    Triggers & Actions
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    {filteredTriggersActions.map((item) => (
                      <PaletteItemButton
                        key={item.type}
                        item={item}
                        onSelect={onAddNode}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {(!isSearching || filteredAgents.length > 0) && (
                <AccordionItem value="existing-agents" className="border-b-0">
                  <AccordionTrigger className="text-muted-foreground py-2 text-xs font-semibold tracking-wide uppercase hover:no-underline">
                    Existing agents
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 pb-2">
                    {agents.length === 0 ? (
                      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-center text-xs">
                        No agents yet. Create one in Agents to reuse it here.
                      </p>
                    ) : (
                      filteredAgents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => onAddAgentNode(agent)}
                          className="hover:bg-accent flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors"
                        >
                          <div className="bg-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                            <Bot className="text-primary h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">
                                {agent.name}
                              </span>
                              {agent.isBuiltIn && (
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  Built-in
                                </Badge>
                              )}
                            </div>
                            {agent.description && (
                              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
                                {agent.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                    {!isSearching && (
                      <Link
                        href={ROUTES.AGENTS.path}
                        className="hover:bg-accent flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors"
                      >
                        <div className="bg-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                          <ArrowUpRight className="text-muted-foreground h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-tight font-medium">
                            View all agents
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                            Browse and manage all agents
                          </p>
                        </div>
                      </Link>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </>
        )}
      </div>
    </div>
  );
}
