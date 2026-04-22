"use client";

import { ChatHistoryCard } from "@/components/chat/chat-history-card";
import { EmptyState } from "@/components/empty-state";
import { NotFoundMessage } from "@/components/not-found-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/routes";
import { useAppStore } from "@/lib/store";
import { Bot, MessageSquarePlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateChat } from "@/hooks/use-create-chat";

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
  const createNewChat = useCreateChat();
  const updateAssistantDb = useAppStore((state) => state.updateAssistantDb);
  const deleteAssistantDb = useAppStore((state) => state.deleteAssistantDb);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!assistant) return <NotFoundMessage entity="Assistant" />;

  const handleNewChat = () => createNewChat("New Chat", undefined, assistantId);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssistantDb(assistantId, {
        prompt: promptRef.current?.value ?? assistant.prompt,
      });
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(`Delete assistant "${assistant.name}"? This cannot be undone.`)
    )
      return;
    setDeleting(true);
    try {
      await deleteAssistantDb(assistantId);
      toast.success("Assistant deleted");
      router.push(ROUTES.ASSISTANTS.path);
    } catch {
      toast.error("Failed to delete assistant");
      setDeleting(false);
    }
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
                  ref={promptRef}
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
            <CardFooter className="flex justify-between">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Assistant"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
