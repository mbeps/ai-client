"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  MessageSquarePlus,
  FolderOpen,
  Bot,
  Database,
  Wrench,
  Search,
  MessageSquare,
  Settings,
  ChevronsUpDown,
  LogOut,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { listChats } from "@/lib/actions/chats/list-chats";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/routes";
import { useCreateChat } from "@/hooks/use-create-chat";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

import { ChatActionMenu } from "./chat-action-menu";

/**
 * Main application sidebar used across all authenticated routes.
 * Displays a "New Chat" button, a Search button, navigation links (Projects,
 * Assistants, Knowledgebases), up to 20 recent chats from the Zustand store
 * (sorted by `updatedAt`), and a footer with the current user's avatar and
 * a dropdown for profile, settings, and sign-out.
 *
 * @author Maruf Bepary
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { isMobile } = useSidebar();

  const chats = useAppStore((state) => state.chats);
  const loadChats = useAppStore((state) => state.loadChats);
  const createNewChat = useCreateChat();

  const recentChats = Object.values(chats)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 20);

  React.useEffect(() => {
    listChats()
      .then((rows) => {
        loadChats(rows, []);
      })
      .catch(() => {
        // silently ignore — sidebar will show empty state
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewChat = () => createNewChat();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleNewChat}
              tooltip="New Chat"
              className="font-semibold h-10"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New Chat
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search">
              <Search className="h-4 w-4" />
              Search
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
              <SidebarMenuButton asChild tooltip="Tools">
                <Link href={ROUTES.TOOLS.path}>
                  <Wrench className="h-4 w-4" />
                  <span>Tools</span>
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
              className="hover:text-primary cursor-pointer flex items-center w-full"
            >
              Recent Chats
            </Link>
          </SidebarGroupLabel>
          <SidebarMenu>
            {recentChats.map((chat) => (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton asChild tooltip={chat.title}>
                  <Link href={ROUTES.CHATS.detail(chat.id)}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{chat.title}</span>
                  </Link>
                </SidebarMenuButton>
                <ChatActionMenu chat={chat} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
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
                      className="cursor-pointer w-full"
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={ROUTES.PROFILE.path}
                      className="cursor-pointer w-full"
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
                    router.push(ROUTES.AUTH.LOGIN.path);
                  }}
                  className="focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
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
