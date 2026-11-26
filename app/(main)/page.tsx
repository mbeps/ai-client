"use client";

import { ArrowRight, Bot, Database, FolderOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { ChatUI } from "@/components/chat/chat-ui";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { authClient } from "@/lib/auth/auth-client";

const QUICK_ACTIONS = [
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
] as const;

/**
 * Dashboard home page reusing ChatUI in lazy-create mode with welcome greeting
 * and quick-action shortcuts as the empty-thread state.
 * Route: /. Protected route — requires active authentication session.
 *
 * @author Maruf Bepary
 */
export default function HomePage() {
  const { data: session } = authClient.useSession();

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-10 md:py-16">
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

      <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        {QUICK_ACTIONS.map((action) => (
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
                  <div className="text-sm font-semibold">{action.label}</div>
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
  );

  return <ChatUI emptyState={emptyState} />;
}
