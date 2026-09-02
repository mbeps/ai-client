"use client";

import {
  Bot,
  ChevronRight,
  ChevronsUpDown,
  Database,
  FolderOpen,
  LogOut,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Settings,
  User,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ChatOptions } from "@/components/chat/chat-options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/constants/routes";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { hydratedResources } from "@/hooks/use-resource-hydration";
import { listChats } from "@/lib/actions/chats/list-chats";
import { authClient } from "@/lib/auth/auth-client";
import { useAppStore } from "@/lib/store";
import { cn, sortByUpdatedAt } from "@/lib/utils";

/**
 * Main application sidebar for authenticated routes.
 * Renders the "New Chat" button, navigation sections (Projects, Assistants, Knowledgebases),
 * up to 20 recent chats (sorted by `updatedAt` from Zustand store), and user footer with avatar dropdown.
 * Fetches chat history on mount via `listChats()` and handles optimistic UI with Zustand.
 * Responsive: collapses on mobile via `useSidebar()` hook.
 *
 * @see ChatActionMenu for per-chat action menu (rename, move, delete)
 * @see useCreateChat for new chat initialization
 * @see useAppStore for chat state management
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { isMobile } = useSidebar();

  const chats = useAppStore((state) => state.chats);
  const loadChats = useAppStore((state) => state.loadChats);
  const createNewChat = useCreateChat();
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
          <SidebarGroupAction
            onClick={() => setIsChatsCollapsed(!isChatsCollapsed)}
            title={isChatsCollapsed ? "Expand" : "Collapse"}
          >
            <ChevronRight
              className={cn(
                "transition-transform duration-200",
                !isChatsCollapsed && "rotate-90",
              )}
            />
          </SidebarGroupAction>
          {!isChatsCollapsed && (
            <SidebarMenu>
              {recentChats.map((chat) => {
                const href = chat.projectId
                  ? ROUTES.PROJECTS.chat(chat.projectId, chat.id)
                  : ROUTES.CHATS.detail(chat.id);
                return (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton asChild tooltip={chat.title}>
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={session?.user?.image || undefined}
                      alt={session?.user?.name || ""}
                    />
                    <AvatarFallback className="rounded-lg">
                      {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {session?.user?.name}
                    </span>
                    <span className="truncate text-xs">
                      {session?.user?.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={session?.user?.image || undefined}
                        alt={session?.user?.name || ""}
                      />
                      <AvatarFallback className="rounded-lg">
                        {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {session?.user?.name}
                      </span>
                      <span className="truncate text-xs">
                        {session?.user?.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link
                      href={ROUTES.PROFILE.path}
                      className="w-full cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={ROUTES.SETTINGS.path}
                      className="w-full cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    useAppStore.getState().resetEntityState();
                    useAppStore.getState().resetChatState();
                    hydratedResources.clear();
                    router.push(ROUTES.AUTH.LOGIN.path);
                  }}
                  className="cursor-pointer focus:bg-destructive focus:text-destructive-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
