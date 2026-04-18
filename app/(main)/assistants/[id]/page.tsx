"use client";

import { useAppStore } from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Bot } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { EmptyState } from "@/components/empty-state";
import { ChatHistoryCard } from "@/components/chat/chat-history-card";

/**
 * Assistant detail page with Past Chats and Configuration tabs.
 * Route: /assistants/[id]. Reads the assistant and all chats bound to it from Zustand.
 *
 * @author Maruf Bepary
 */
export default function AssistantPage() {
  const params = useParams();
  const router = useRouter();
  const assistantId = params.id as string;

  const assistant = useAppStore((state) =>
    state.assistants.find((a) => a.id === assistantId),
  );
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.assistantId === assistantId,
  );
  const createChat = useAppStore((state) => state.createChat);

  if (!assistant) return <NotFoundMessage entity="Assistant" />;

  const handleNewChat = () => {
    const chatId = createChat(undefined, assistantId);
    router.push(ROUTES.CHATS.detail(chatId));
  };

  return (
    <div className="page-container-detail">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{assistant.name}</h1>
          <p className="text-muted-foreground">{assistant.description}</p>
        </div>
        <Button onClick={handleNewChat} size="lg">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Chat with Assistant
        </Button>
      </div>

      <Tabs defaultValue="chats" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="chats">Past Chats</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chats.map((chat) => (
              <ChatHistoryCard
                key={chat.id}
                title={chat.title}
                updatedAt={chat.updatedAt}
                href={ROUTES.CHATS.detail(chat.id)}
              />
            ))}
            {chats.length === 0 && (
              <EmptyState message="No chats with this assistant yet." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Assistant Configuration</CardTitle>
              <CardDescription>
                Customize the persona and capabilities of this assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">System Prompt</label>
                <Textarea
                  defaultValue={assistant.prompt}
                  rows={8}
                  placeholder="e.g., You are a friendly helpful assistant."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enabled Tools (MCP)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {assistant.tools.map((tool) => (
                    <div
                      key={tool}
                      className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                    >
                      {tool}
                    </div>
                  ))}
                  {assistant.tools.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No tools enabled.
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-2">
                  Manage Tools
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save Configuration</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
