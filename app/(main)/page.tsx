"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { Bot, FolderOpen, Database, Sparkles, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { ChatInput } from "@/components/chat/chat-input";
import { ROUTES } from "@/constants/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useUserModels } from "@/hooks/use-user-models";
import { toast } from "sonner";

/**
 * Dashboard home page with user greeting, quick-action shortcuts, and inline chat launcher.
 * Route: /. Reads session user via Better Auth and creates new chat on submission.
 * Protected route — requires active authentication session.
 *
 * @returns Home page with quick actions, recent chats, and chat input form.
 * @see ChatPageClient for chat detail view after new chat creation.
 * @author Maruf Bepary
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const createChatDb = useAppStore((state) => state.createChatDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const publicMcpServers = useAppStore((state) => state.publicMcpServers);
  const { models: chatModels } = useUserModels("chat");

  useResourceHydration(["mcpServers", "publicMcpServers"]);

  const enabledServers = useMemo(() => {
    return [...mcpServers, ...publicMcpServers].filter((s) => s.enabled);
  }, [mcpServers, publicMcpServers]);

  const handleStart = async (content: string) => {
    if (!content.trim()) return;

    if (chatModels.length === 0) {
      toast.error("No AI models configured. Please set up a provider first.", {
        action: {
          label: "Settings",
          onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
        },
      });
      return;
    }

    const chatId = await createChatDb(content.slice(0, 60));
    router.push(
      `${ROUTES.CHATS.detail(chatId)}?msg=${encodeURIComponent(content)}`,
    );
  };

  const quickActions = [
    {
      label: "Projects",
      icon: FolderOpen,
      href: ROUTES.PROJECTS.path,
      description: "Manage workspaces",
    },
    {
      label: "Assistants",
      icon: Bot,
      href: ROUTES.ASSISTANTS.path,
      description: "Custom AI personas",
    },
    {
      label: "Knowledgebases",
      icon: Database,
      href: ROUTES.KNOWLEDGEBASES.path,
      description: "Your documents",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col items-center justify-between md:justify-center h-full px-4 py-6 md:py-12 overflow-y-auto">
        {/* Welcome heading and Quick Actions */}
        <div className="flex flex-col items-center justify-center w-full flex-1 md:flex-initial">
          <div className="text-center mb-8 md:mb-10 space-y-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Hello, {session?.user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              How can I help you today?
            </p>
          </div>

          {/* Quick navigation */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8 w-full sm:w-auto justify-center">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  className="gap-3 h-auto py-3 px-4 w-full sm:w-auto justify-between sm:justify-start"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="h-5 w-5 text-primary/80" />
                    <div className="text-left">
                      <div className="text-sm font-semibold">
                        {action.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Chat input */}
        <div className="w-full max-w-3xl mt-auto md:mt-0 pb-2 md:pb-0">
          <ChatInput onSend={handleStart} servers={enabledServers} />
        </div>
      </div>
    </div>
  );
}
