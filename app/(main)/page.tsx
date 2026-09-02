"use client";

import { ArrowRight, Bot, Database, FolderOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useUserModels } from "@/hooks/use-user-models";
import { authClient } from "@/lib/auth/auth-client";
import { useAppStore } from "@/lib/store";

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
  const mcpServers = useAppStore((state) => state.mcpServers);
  const { models: chatModels } = useUserModels("chat");

  useResourceHydration(["mcpServers"]);

  const enabledServers = useMemo(() => {
    return mcpServers.filter((s) => s.enabled);
  }, [mcpServers]);

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-full flex-col items-center justify-between overflow-y-auto px-4 py-6 md:justify-center md:py-12">
        {/* Welcome heading and Quick Actions */}
        <div className="flex w-full flex-1 flex-col items-center justify-center md:flex-initial">
          <div className="mb-8 space-y-2 text-center md:mb-10">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-bold text-3xl tracking-tight md:text-4xl">
              Hello, {session?.user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
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
                    <action.icon className="h-5 w-5 text-primary/80" />
                    <div className="text-left">
                      <div className="font-semibold text-sm">
                        {action.label}
                      </div>
                      <div className="text-muted-foreground text-xs">
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
        <div className="mt-auto w-full max-w-3xl pb-2 md:mt-0 md:pb-0">
          <ChatInput onSend={handleStart} servers={enabledServers} />
        </div>
      </div>
    </div>
  );
}
