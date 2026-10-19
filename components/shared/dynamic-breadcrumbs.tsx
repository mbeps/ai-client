"use client";

import { format } from "date-fns";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { getKnowledgebase } from "@/actions/knowledgebases/get-knowledgebase";
import { listProviders } from "@/actions/providers/list-providers";
import { getSkill } from "@/actions/skills/get-skill";
import { getTransformAgent } from "@/actions/transform-agents/get-transform-agent";
import { getTransformRun } from "@/actions/transform-runs/get-transform-run";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTES } from "@/config/routes";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import { getPathSegments } from "@/lib/utils";

/**
 * Friendly labels for known route segments.
 */
const ROUTE_LABELS: Record<string, string> = {
  chats: "Chats",
  projects: "Projects",
  assistants: "Assistants",
  knowledgebases: "Knowledge Bases",
  tools: "Tools",
  skills: "Skills",
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
  transform: "Step-by-Step Automations",
  new: "New",
};

/**
 * UUID regex for identifying entity IDs in path segments.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StoreLookupEntities {
  projects: Array<{ id: string }>;
  assistants: Array<{ id: string }>;
  prompts: Array<{ id: string }>;
  skills: Array<{ id: string }>;
  mcpServers: Array<{ id: string }>;
  transformAgents: Array<{ id: string }>;
}

interface BreadcrumbLabelContext {
  isChatSegment: boolean;
  currentChatData?: {
    title?: string;
    projectId?: string | null;
    projectName?: string | null;
    assistantId?: string | null;
    assistantName?: string | null;
  };
  projects: Array<{ id: string; name: string }>;
  assistants: Array<{ id: string; name: string }>;
  prompts: Array<{ id: string; title: string }>;
  skills: Array<{ id: string; name: string; displayName?: string | null }>;
  mcpServers: Array<{ id: string; name: string }>;
  transformAgents: Array<{ id: string; name: string }>;
  resolvedLabels: Record<string, string>;
}

/**
 * Resolves a transform workflow run segment to a formatted creation date string.
 *
 * @param segment - Run UUID segment
 * @returns Formatted date string or null if not found/error
 */
async function resolveTransformRunLabel(
  segment: string,
): Promise<string | null> {
  try {
    const run = await getTransformRun(segment);
    if (run) {
      return format(new Date(run.createdAt), "dd/MM/yyyy HH:mm");
    }
  } catch (err) {
    logger.error("Failed to resolve run label", err);
  }
  return null;
}

/**
 * Resolves a transform workflow agent segment to its agent name.
 *
 * @param segment - Agent UUID segment
 * @returns Agent name or null if not found/error
 */
async function resolveTransformAgentLabel(
  segment: string,
): Promise<string | null> {
  try {
    const agent = await getTransformAgent(segment);
    if (agent) {
      return agent.name;
    }
  } catch (err) {
    logger.error("Failed to resolve transform agent label", err);
  }
  return null;
}

/**
 * Resolves a knowledgebase segment to its knowledgebase name.
 *
 * @param segment - Knowledgebase UUID segment
 * @returns Knowledgebase name or null if not found/error
 */
async function resolveKnowledgebaseLabel(
  segment: string,
): Promise<string | null> {
  try {
    const kb = await getKnowledgebase(segment);
    if (kb) {
      return kb.name;
    }
  } catch (err) {
    logger.error("Failed to resolve knowledgebase label", err);
  }
  return null;
}

/**
 * Resolves an AI provider segment to its provider name.
 *
 * @param segment - Provider UUID segment
 * @returns Provider name or null if not found/error
 */
async function resolveProviderLabel(segment: string): Promise<string | null> {
  try {
    const allProviders = await listProviders();
    const provider = allProviders.find((p) => p.id === segment);
    if (provider) {
      return provider.name;
    }
  } catch (err) {
    logger.error("Failed to resolve provider label", err);
  }
  return null;
}

/**
 * Resolves a skill segment to its display name or internal name.
 *
 * @param segment - Skill UUID segment
 * @returns Skill display name / name or null if not found/error
 */
async function resolveSkillLabel(segment: string): Promise<string | null> {
  try {
    const skill = await getSkill(segment);
    if (skill) {
      return skill.displayName || skill.name;
    }
  } catch (err) {
    logger.error("Failed to resolve skill label", err);
  }
  return null;
}

/**
 * Resolves a dynamic URL segment to its human-readable label via server actions.
 *
 * @param segment - Target URL path segment to resolve
 * @param prevSegment - Preceding path segment providing context
 * @param pathname - Full URL pathname for routing disambiguation
 * @returns Resolved label or null if the segment does not match dynamic entities
 */
async function resolveDynamicSegmentLabel(
  segment: string,
  prevSegment: string | undefined,
  pathname: string,
): Promise<string | null> {
  if (pathname.startsWith(ROUTES.WORKFLOWS.TRANSFORM.path)) {
    if (prevSegment && UUID_REGEX.test(prevSegment)) {
      return resolveTransformRunLabel(segment);
    }
    if (prevSegment === "transform") {
      return resolveTransformAgentLabel(segment);
    }
    return null;
  }

  if (prevSegment === "knowledgebases") {
    return resolveKnowledgebaseLabel(segment);
  }
  if (prevSegment === "providers") {
    return resolveProviderLabel(segment);
  }
  if (prevSegment === "skills") {
    return resolveSkillLabel(segment);
  }
  return null;
}

/**
 * Checks whether a given path segment already exists in store collections.
 *
 * @param segment - Segment to test
 * @param store - Current store entity collections
 * @param chatId - Active chat ID from the URL if present
 * @param hasCurrentChat - Whether active chat data is already present in store
 * @returns True if already present in store
 */
function isSegmentInStore(
  segment: string,
  store: StoreLookupEntities,
  chatId: string | null,
  hasCurrentChat: boolean,
): boolean {
  if (chatId === segment && hasCurrentChat) return true;
  if (store.projects.some((p) => p.id === segment)) return true;
  if (store.assistants.some((a) => a.id === segment)) return true;
  if (store.prompts.some((p) => p.id === segment)) return true;
  if (store.skills.some((s) => s.id === segment)) return true;
  if (store.mcpServers.some((s) => s.id === segment)) return true;
  if (store.transformAgents.some((a) => a.id === segment)) return true;
  return false;
}

/**
 * Formats fallback display text for segments that do not resolve to named entities.
 *
 * @param segment - Path segment to format
 * @returns Human-friendly label
 */
function formatFallbackSegment(segment: string): string {
  const routeLabel = ROUTE_LABELS[segment.toLowerCase()];
  if (routeLabel) return routeLabel;
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

/**
 * Resolves a segment label from store-backed entities.
 *
 * @param segment - Path segment
 * @param ctx - Entity lists from the store
 * @returns Entity name/title or undefined
 */
function resolveStoreEntityLabel(
  segment: string,
  ctx: Pick<
    BreadcrumbLabelContext,
    | "projects"
    | "assistants"
    | "prompts"
    | "skills"
    | "mcpServers"
    | "transformAgents"
  >,
): string | undefined {
  const project = ctx.projects.find((p) => p.id === segment);
  if (project) return project.name;

  const assistant = ctx.assistants.find((a) => a.id === segment);
  if (assistant) return assistant.name;

  const prompt = ctx.prompts.find((p) => p.id === segment);
  if (prompt) return prompt.title;

  const skill = ctx.skills.find((s) => s.id === segment);
  if (skill) return skill.displayName || skill.name;

  const mcp = ctx.mcpServers.find((s) => s.id === segment);
  if (mcp) return mcp.name;

  const agent = ctx.transformAgents.find((a) => a.id === segment);
  if (agent) return agent.name;

  return undefined;
}

/**
 * Resolves project or assistant parent names from the active chat context.
 *
 * @param segment - Path segment
 * @param chatData - Active chat data
 * @returns Parent project or assistant name, or undefined
 */
function resolveChatParentLabel(
  segment: string,
  chatData: NonNullable<BreadcrumbLabelContext["currentChatData"]>,
): string | undefined {
  if (chatData.projectId === segment && chatData.projectName) {
    return chatData.projectName;
  }
  if (chatData.assistantId === segment && chatData.assistantName) {
    return chatData.assistantName;
  }
  return undefined;
}

/**
 * Resolves a breadcrumb label from active chat context.
 *
 * @param segment - Path segment
 * @param isChatSegment - Whether this segment represents the active chat ID
 * @param currentChatData - Active chat data from store if present
 * @returns Chat, project, or assistant title/name from the active chat
 */
function resolveChatContextLabel(
  segment: string,
  isChatSegment: boolean,
  currentChatData?: BreadcrumbLabelContext["currentChatData"],
): string | undefined {
  if (!currentChatData) return undefined;
  if (isChatSegment && currentChatData.title) {
    return currentChatData.title;
  }
  return resolveChatParentLabel(segment, currentChatData);
}

/**
 * Computes the final user-facing breadcrumb display label for a path segment.
 *
 * @param segment - Path segment to resolve
 * @param ctx - Context containing store entities, chat data, and resolved labels
 * @returns Human-readable breadcrumb label
 */
function resolveBreadcrumbDisplayLabel(
  segment: string,
  ctx: BreadcrumbLabelContext,
): string {
  const chatLabel = resolveChatContextLabel(
    segment,
    ctx.isChatSegment,
    ctx.currentChatData,
  );
  if (chatLabel) return chatLabel;

  const storeLabel = resolveStoreEntityLabel(segment, ctx);
  if (storeLabel) return storeLabel;

  const resolved = ctx.resolvedLabels[segment];
  if (resolved) return resolved;

  return formatFallbackSegment(segment);
}

/**
 * Dynamic breadcrumb component that generates navigation links based on the current URL.
 * Automatically maps technical path segments to user-friendly labels.
 *
 * @returns A Shadcn UI Breadcrumb component or null if at the root.
 */
export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const {
    projects,
    assistants,
    prompts,
    skills,
    mcpServers,
    publicMcpServers,
    transformAgents,
    loadProjects,
    loadPrompts,
    loadAssistants,
    loadSkills,
    loadMcpServers,
    loadPublicMcpServers,
    loadTransformAgents,
  } = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      assistants: state.assistants,
      prompts: state.prompts,
      skills: state.skills,
      mcpServers: state.mcpServers,
      publicMcpServers: state.publicMcpServers,
      transformAgents: state.transformAgents,
      loadProjects: state.loadProjects,
      loadPrompts: state.loadPrompts,
      loadAssistants: state.loadAssistants,
      loadSkills: state.loadSkills,
      loadMcpServers: state.loadMcpServers,
      loadPublicMcpServers: state.loadPublicMcpServers,
      loadTransformAgents: state.loadTransformAgents,
    })),
  );

  // Narrow subscription: only the single chat whose ID appears in the current URL
  const pathSegments = React.useMemo(
    () => getPathSegments(pathname),
    [pathname],
  );
  const chatId = React.useMemo(() => {
    // /chats/[id]
    if (
      pathSegments[0] === "chats" &&
      pathSegments[1] &&
      UUID_REGEX.test(pathSegments[1])
    ) {
      return pathSegments[1];
    }
    // /projects/[id]/[chatId] or /assistants/[id]/[chatId]
    if (
      (pathSegments[0] === "projects" || pathSegments[0] === "assistants") &&
      pathSegments.length >= 3 &&
      pathSegments[2] &&
      UUID_REGEX.test(pathSegments[2])
    ) {
      return pathSegments[2];
    }
    return null;
  }, [pathSegments]);

  const currentChatData = useAppStore((s) =>
    chatId ? s.chats[chatId] : undefined,
  );

  const [resolvedLabels, setResolvedLabels] = React.useState<
    Record<string, string>
  >({});
  const resolutionAttempted = React.useRef<Set<string>>(new Set());

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

  // Load skills if not available
  React.useEffect(() => {
    if (skills.length === 0) {
      loadSkills().catch(() => {});
    }
  }, [skills.length, loadSkills]);

  // Load MCP servers if not available
  React.useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, [mcpServers.length, loadMcpServers]);

  // Load Public MCP servers — guard prevents re-fetch on every mount
  React.useEffect(() => {
    if (publicMcpServers.length === 0) {
      loadPublicMcpServers().catch(() => {});
    }
  }, [publicMcpServers.length, loadPublicMcpServers]);

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
    const segments = getPathSegments(pathname);

    const resolveAll = async () => {
      const updates: Record<string, string> = {};

      await Promise.all(
        segments.map(async (segment, index) => {
          const inStore = isSegmentInStore(
            segment,
            {
              projects,
              assistants,
              prompts,
              skills,
              mcpServers,
              transformAgents,
            },
            chatId,
            Boolean(currentChatData),
          );

          if (
            UUID_REGEX.test(segment) &&
            !resolvedLabels[segment] &&
            !resolutionAttempted.current.has(segment) &&
            !inStore
          ) {
            const prevSegment = segments[index - 1];
            const label = await resolveDynamicSegmentLabel(
              segment,
              prevSegment,
              pathname,
            );
            if (label) {
              updates[segment] = label;
            }
          }
        }),
      );

      if (Object.keys(updates).length > 0) {
        // Only mark as attempted once a label actually lands, so a failed
        // fetch (or an unmount) retries on the next effect run instead of
        // permanently falling back to the raw ID.
        for (const id of Object.keys(updates)) {
          resolutionAttempted.current.add(id);
        }
        setResolvedLabels((prev) => ({ ...prev, ...updates }));
      }
    };

    resolveAll();
  }, [
    pathname,
    projects,
    assistants,
    prompts,
    skills,
    mcpServers,
    transformAgents,
    chatId,
    currentChatData,
    resolvedLabels,
  ]);

  // Use path segments computed above (pathSegments)
  if (pathSegments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathSegments.map((segment, index) => {
          const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
          const isLast = index === pathSegments.length - 1;

          const isChatSegment = chatId === segment;
          const label = resolveBreadcrumbDisplayLabel(segment, {
            isChatSegment,
            currentChatData,
            projects,
            assistants,
            prompts,
            skills,
            mcpServers,
            transformAgents,
            resolvedLabels,
          });

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
