"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { Bot, FolderOpen, Database, Sparkles, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { ChatInput } from "@/components/chat/chat-input";
import { ROUTES } from "@/lib/routes";

/**
 * Dashboard home page with a personalised greeting and quick-start chat input.
 * Route: /. Reads the session user name from Better Auth and dispatches
 * createChat/addMessage to the Zustand store to open a new conversation.
 *
 * @author Maruf Bepary
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const createChat = useAppStore((state) => state.createChat);
  const addMessage = useAppStore((state) => state.addMessage);
  const handleStart = (content: string) => {
    if (!content.trim()) return;
    const chatId = createChat();
    addMessage(chatId, "user", content.trim(), null);
    router.push(ROUTES.CHATS.detail(chatId));
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
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
        {/* Welcome heading */}
        <div className="text-center mb-10 space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Hello, {session?.user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground text-lg">
            How can I help you today?
          </p>
        </div>

        {/* Quick navigation */}
        <div className="flex gap-3 mb-8 flex-wrap justify-center">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button variant="outline" className="gap-2 h-auto py-2 px-4">
                <action.icon className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 ml-1 text-muted-foreground" />
              </Button>
            </Link>
          ))}
        </div>

        {/* Chat input */}
        <div className="w-full max-w-3xl">
          <ChatInput onSend={handleStart} />
        </div>
      </div>
    </div>
  );
}
