"use client";

import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  FolderOpen,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { listChats } from "@/actions/chats/list-chats";
import { ChatOptions } from "@/components/chat/chat-options";
import { SidebarUserFooter } from "@/components/sidebar/sidebar-user-footer";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { useAppStore } from "@/lib/store";
import { cn, sortByUpdatedAt } from "@/lib/utils";

/**
 * Main application sidebar for authenticated routes.
 * Renders the "New Chat" button, navigation sections (Projects, Assistants, Knowledgebases),
 * up to 20 recent chats (sorted by `updatedAt` from Zustand store), and user footer with avatar dropdown.
 * Fetches chat history on mount via `listChats()` and handles optimistic UI with Zustand.
 *
 * @see ChatActionMenu for per-chat action menu (rename, move, delete)
 * @see useCreateChat for new chat initialization
 * @see useAppStore for chat state management
 * @see SidebarUserFooter for the user profile footer and action dropdown
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const chats = useAppStore((state) => state.chats);
  const loadChats = useAppStore((state) => state.loadChats);
  const createNewChat = useCreateChat();
  const pathname = usePathname();
  const [isChatsCollapsed, setIsChatsCollapsed] = React.useState(false);

  const recentChats = sortByUpdatedAt(
    Object.values(chats).filter((chat) => !chat.projectId),
  ).slice(0, 20);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Load chats once on sidebar mount
  React.useEffect(() => {
    listChats()
      .then((rows) => {
        loadChats(rows, []);
      })
      .catch(() => {
        // silently ignore — sidebar will show empty state
      });
  }, []);

  const handleNewChat = () => createNewChat();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleNewChat}
              tooltip="New Chat"
              className="h-10 font-semibold"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New Chat
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Search">
              <Link href={ROUTES.SEARCH.path}>
                <Search className="h-4 w-4" />
                Search
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Projects">
                <Link href={ROUTES.PROJECTS.path}>
                  <FolderOpen className="h-4 w-4" />
                  <span>Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Assistants">
                <Link href={ROUTES.ASSISTANTS.path}>
                  <Bot className="h-4 w-4" />
                  <span>Assistants</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Knowledgebases">
                <Link href={ROUTES.KNOWLEDGEBASES.path}>
                  <Database className="h-4 w-4" />
                  <span>Knowledgebases</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Workflows">
                <Link href={ROUTES.WORKFLOWS.path}>
                  <Workflow className="h-4 w-4" />
                  <span>Workflows</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Running Jobs">
                <Link href={ROUTES.JOBS.path}>
                  <Activity className="h-4 w-4" />
                  <span>Running Jobs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Recent Chats */}
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <Link
              href={ROUTES.CHATS.path}
              className="flex w-full cursor-pointer items-center hover:text-primary"
            >
              Recent Chats
            </Link>
          </SidebarGroupLabel>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarGroupAction
                onClick={() => setIsChatsCollapsed(!isChatsCollapsed)}
                aria-label={isChatsCollapsed ? "Expand" : "Collapse"}
              >
                <ChevronRight
                  className={cn(
                    "transition-transform duration-200",
                    !isChatsCollapsed && "rotate-90",
                  )}
                />
              </SidebarGroupAction>
            </TooltipTrigger>
            <TooltipContent>
              {isChatsCollapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
          {!isChatsCollapsed && (
            <SidebarMenu>
              {recentChats.map((chat) => {
                const href = chat.projectId
                  ? ROUTES.PROJECTS.chat(chat.projectId, chat.id)
                  : ROUTES.CHATS.detail(chat.id);
                return (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                        asChild
                        tooltip={chat.title}
                        isActive={pathname === href}
                      >
                      <Link href={href}>
                        <MessageSquare className="h-4 w-4" />
                        <span className="truncate">{chat.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <ChatOptions
                      chat={chat}
                      trigger={
                        <SidebarMenuAction className="lg:opacity-0 lg:group-hover/menu-item:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarUserFooter />

      <SidebarRail />
    </Sidebar>
  );
}
