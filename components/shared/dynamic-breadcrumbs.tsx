"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { format } from "date-fns";
import { getTransformRun } from "@/lib/actions/transform-runs/get-transform-run";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { getKnowledgebase } from "@/lib/actions/knowledgebases/get-knowledgebase";
import { ROUTES } from "@/constants/routes";

/**
 * Friendly labels for known route segments.
 */
const ROUTE_LABELS: Record<string, string> = {
  chats: "Chats",
  projects: "Projects",
  assistants: "Assistants",
  knowledgebases: "Knowledge Bases",
  tools: "Tools",
  profile: "Profile",
  security: "Security",
  sessions: "Sessions",
  accounts: "Linked Accounts",
  danger: "Danger Zone",
  general: "General",
  settings: "Settings",
  prompts: "Prompts",
  workflows: "Workflows",
  translation: "Translation",
  transform: "Spreadsheets Automation",
  new: "New",
};

/**
 * UUID regex for identifying entity IDs in path segments.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dynamic breadcrumb component that generates navigation links based on the current URL.
 * Automatically maps technical path segments to user-friendly labels.
 *
 * @returns A Shadcn UI Breadcrumb component or null if at the root.
 */
export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const {
    chats,
    projects,
    assistants,
    prompts,
    mcpServers,
    transformAgents,
    loadProjects,
    loadPrompts,
    loadAssistants,
    loadMcpServers,
    loadPublicMcpServers,
    loadTransformAgents,
  } = useAppStore(
    useShallow((state) => ({
      chats: state.chats,
      projects: state.projects,
      assistants: state.assistants,
      prompts: state.prompts,
      mcpServers: state.mcpServers,
      transformAgents: state.transformAgents,
      loadProjects: state.loadProjects,
      loadPrompts: state.loadPrompts,
      loadAssistants: state.loadAssistants,
      loadMcpServers: state.loadMcpServers,
      loadPublicMcpServers: state.loadPublicMcpServers,
      loadTransformAgents: state.loadTransformAgents,
    })),
  );

  const [resolvedLabels, setResolvedLabels] = React.useState<
    Record<string, string>
  >({});

  // Load projects if not available
  React.useEffect(() => {
    if (projects.length === 0) {
      loadProjects().catch(() => {});
    }
  }, [projects.length, loadProjects]);

  // Load assistants if not available
  React.useEffect(() => {
    if (assistants.length === 0) {
      loadAssistants().catch(() => {});
    }
  }, [assistants.length, loadAssistants]);

  // Load prompts if not available
  React.useEffect(() => {
    if (prompts.length === 0) {
      loadPrompts().catch(() => {});
    }
  }, [prompts.length, loadPrompts]);

  // Load MCP servers if not available
  React.useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, [mcpServers.length, loadMcpServers]);

  // Load Public MCP servers
  React.useEffect(() => {
    loadPublicMcpServers().catch(() => {});
  }, [loadPublicMcpServers]);

  // Load transform agents if on a transform workflow path
  React.useEffect(() => {
    if (
      pathname.includes(ROUTES.WORKFLOWS.TRANSFORM.path) &&
      transformAgents.length === 0
    ) {
      loadTransformAgents().catch(() => {});
    }
  }, [pathname, transformAgents.length, loadTransformAgents]);

  // Resolve IDs that aren't in state
  React.useEffect(() => {
    let ignore = false;
    const segments = pathname.split("/").filter(Boolean);

    const resolveAll = async () => {
      const updates: Record<string, string> = {};

      await Promise.all(
        segments.map(async (segment, index) => {
          // Check if it's already in our store to avoid redundant fetches
          const inStore =
            projects.some((p) => p.id === segment) ||
            assistants.some((a) => a.id === segment) ||
            prompts.some((p) => p.id === segment) ||
            mcpServers.some((s) => s.id === segment) ||
            transformAgents.some((a) => a.id === segment) ||
            chats[segment];

          if (
            UUID_REGEX.test(segment) &&
            !resolvedLabels[segment] &&
            !inStore
          ) {
            const prevSegment = segments[index - 1];

            // 1. Check if it's a Run segment (URL: /workflows/transform/[agentId]/[runId])
            if (prevSegment && UUID_REGEX.test(prevSegment)) {
              try {
                const run = await getTransformRun(segment);
                if (run) {
                  const agent = await getTransformAgent(run.agentId);
                  const dateStr = format(
                    new Date(run.createdAt),
                    "dd/MM/yyyy HH:mm",
                  );
                  const label = dateStr;

                  updates[segment] = label;
                }
              } catch (err) {
                console.error("Failed to resolve run label:", err);
              }
            }
            // 2. Check if it's a Transform Agent segment (URL: /workflows/transform/[agentId])
            else if (prevSegment === "transform") {
              try {
                const agent = await getTransformAgent(segment);
                if (agent) {
                  updates[segment] = agent.name;
                }
              } catch (err) {
                console.error("Failed to resolve transform agent label:", err);
              }
            }
            // 3. Check if it's a Knowledge Base segment (URL: /knowledgebases/[id])
            else if (prevSegment === "knowledgebases") {
              try {
                const kb = await getKnowledgebase(segment);
                if (kb) {
                  updates[segment] = kb.name;
                }
              } catch (err) {
                console.error("Failed to resolve knowledgebase label:", err);
              }
            }
          }
        }),
      );

      if (!ignore && Object.keys(updates).length > 0) {
        setResolvedLabels((prev) => ({ ...prev, ...updates }));
      }
    };

    resolveAll();

    return () => {
      ignore = true;
    };
  }, [
    pathname,
    projects,
    assistants,
    prompts,
    mcpServers,
    transformAgents,
    chats,
  ]);

  // Split pathname into segments and remove empty strings
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;

          const currentChat = chats[segment];

          // Map segment to label or capitalise it
          const label =
            currentChat?.title ||
            projects.find((p) => p.id === segment)?.name ||
            assistants.find((a) => a.id === segment)?.name ||
            prompts.find((p) => p.id === segment)?.title ||
            mcpServers.find((s) => s.id === segment)?.name ||
            transformAgents.find((a) => a.id === segment)?.name ||
            resolvedLabels[segment] ||
            // Fallback for project/assistant names from chat object
            Object.values(chats).find((c) => c.projectId === segment)
              ?.projectName ||
            Object.values(chats).find((c) => c.assistantId === segment)
              ?.assistantName ||
            ROUTE_LABELS[segment.toLowerCase()] ||
            segment.charAt(0).toUpperCase() +
              segment.slice(1).replace(/-/g, " ");

          return (
            <React.Fragment key={href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
