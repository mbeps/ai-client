"use client";

import { ArrowRight, Bot, Database, FolderOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useUserModels } from "@/hooks/use-user-models";
import { authClient } from "@/lib/auth/auth-client";
import { useAppStore } from "@/lib/store/use-app-store";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Attachment } from "@/types/attachment/attachment";
import type { ApprovalMode } from "@/types/tool/approval";

/**
 * Dashboard home page with user greeting, quick-action shortcuts, and inline chat launcher.
 * Route: /. Reads session user via Better Auth and creates new chat on submission.
 * Protected route — requires active authentication session.
 *
 * @author Maruf Bepary
 * @see {@link ChatPageClient} for chat detail view after new chat creation.
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const createChatDb = useAppStore((state) => state.createChatDb);
  const setKnowledgebaseDb = useAppStore((state) => state.setKnowledgebaseDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const userSettings = useAppStore((state) => state.userSettings);
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");

  useResourceHydration([
    "mcpServers",
    "publicMcpServers",
    "agents",
    "projects",
    "prompts",
    "skills",
    "mcpPrompts",
    "userSettings",
  ]);

  const [isStarting, setIsStarting] = useState(false);

  const enabledServers = useMemo(() => {
    return mcpServers.filter((s) => s.enabled);
  }, [mcpServers]);

  const handleStart = async (
    content: string,
    attachments: Attachment[] = [],
    model = "",
    selectedServerIds: string[] = [],
    selectedTools: string[] = [],
    selectedPromptId?: string | string[],
    selectedAssistantId?: string,
    selectedKnowledgebases: string[] = [],
    selectedSkillIds: string[] = [],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
    reasoningEffort?: ReasoningEffort,
    subagentIds?: string[],
    approvalMode?: ApprovalMode,
  ): Promise<boolean> => {
    if (isStarting || isModelsLoading) return false;

    if (chatModels.length === 0) {
      toast.error("No AI models configured. Please set up a provider first.", {
        action: {
          label: "Settings",
          onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
        },
      });
      return false;
    }

    setIsStarting(true);
    try {
      const title = content.trim().slice(0, 60) || "New Chat";
      const chatId = await createChatDb(title);
      if (selectedKnowledgebases.length > 0) {
        await setKnowledgebaseDb(chatId, selectedKnowledgebases[0]);
      }
      const toolsStore = useChatToolsStore.getState();
      toolsStore.transferChatTools(NEW_CHAT_TOOLS_KEY, chatId);
      toolsStore.setPendingLaunch(chatId, {
        content,
        attachments,
        model,
        selectedServerIds,
        selectedTools,
        selectedPromptId,
        selectedAssistantId,
        selectedKnowledgebases,
        selectedSkillIds,
        subagentsEnabled,
        subagentModelId,
        reasoningEffort,
        subagentIds,
        approvalMode,
      });
      router.push(ROUTES.CHATS.detail(chatId));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start chat",
      );
      setIsStarting(false);
      return false;
    }
  };

  const quickActions = [
    {
      label: "Projects",
      icon: FolderOpen,
      href: ROUTES.PROJECTS.path,
      description: "Manage workspaces",
    },
    {
      label: "Agents",
      icon: Bot,
      href: ROUTES.AGENTS.path,
      description: "Custom AI agents",
    },
    {
      label: "Knowledgebases",
      icon: Database,
      href: ROUTES.KNOWLEDGEBASES.path,
      description: "Your documents",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-full flex-col items-center justify-between overflow-y-auto px-4 py-6 md:justify-center md:py-12">
        {/* Welcome heading and Quick Actions */}
        <div className="flex w-full flex-1 flex-col items-center justify-center md:flex-initial">
          <div className="mb-8 space-y-2 text-center md:mb-10">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Sparkles className="text-primary h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Hello, {session?.user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              How can I help you today?
            </p>
          </div>

          {/* Quick navigation */}
          <div className="mb-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  className="h-auto w-full justify-between gap-3 px-4 py-3 sm:w-auto sm:justify-start"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="text-primary/80 h-5 w-5" />
                    <div className="text-left">
                      <div className="text-sm font-semibold">
                        {action.label}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {action.description}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground/50 h-4 w-4" />
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Chat input */}
        <div className="mt-auto w-full max-w-3xl pb-2 md:mt-0 md:pb-0">
          <ChatInput
            chatId={NEW_CHAT_TOOLS_KEY}
            onSend={handleStart}
            isLoading={isStarting}
            servers={enabledServers}
            initialModelId={userSettings?.defaultChatModelId || undefined}
            initialApprovalMode={
              userSettings?.defaultAutoApprove ? "auto" : "ask"
            }
          />
        </div>
      </div>
    </div>
  );
}
