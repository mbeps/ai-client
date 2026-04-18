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
import { MessageSquarePlus, Database } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { EmptyState } from "@/components/empty-state";
import { ChatHistoryCard } from "@/components/chat/chat-history-card";

/**
 * Project detail page with Chats, Global Prompt, Knowledgebase, and Settings tabs.
 * Route: /projects/[id]. Reads the project, linked chats, and attached knowledge bases from Zustand.
 *
 * @author Maruf Bepary
 */
export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const project = useAppStore((state) =>
    state.projects.find((p) => p.id === projectId),
  );
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.projectId === projectId,
  );
  const allKbs = useAppStore((state) => state.knowledgebases);
  const kbs = allKbs.filter((k) => project?.knowledgebases.includes(k.id));
  const createChat = useAppStore((state) => state.createChat);

  if (!project) return <NotFoundMessage entity="Project" />;

  const handleNewChat = () => {
    const chatId = createChat(projectId);
    router.push(ROUTES.PROJECTS.chat(projectId, chatId));
  };

  const totalKbSize = kbs.reduce((acc, kb) => acc + kb.sizeBytes, 0);
  const maxKbSize =
    kbs.reduce((acc, kb) => acc + kb.maxSizeBytes, 0) || 100 * 1024 * 1024; // Default 100MB if no KB
  const usagePercentage = Math.min(100, (totalKbSize / maxKbSize) * 100);

  return (
    <div className="page-container-detail">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
        <Button onClick={handleNewChat}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat in Project
        </Button>
      </div>

      <Tabs defaultValue="chats" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="prompt">Global Prompt</TabsTrigger>
          <TabsTrigger value="knowledge">
            Knowledgebase ({kbs.length})
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chats.map((chat) => (
              <ChatHistoryCard
                key={chat.id}
                title={chat.title}
                updatedAt={chat.updatedAt}
                href={ROUTES.PROJECTS.chat(projectId, chat.id)}
              />
            ))}
            {chats.length === 0 && (
              <EmptyState message="No chats in this project yet." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle>Global Prompt</CardTitle>
              <CardDescription>
                This prompt will be injected as system instructions for all new
                chats in this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                defaultValue={project.globalPrompt}
                rows={10}
                placeholder="e.g., You are an expert code reviewer specializing in React."
              />
            </CardContent>
            <CardFooter>
              <Button>Save Prompt</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Knowledge</CardTitle>
              <CardDescription>
                Knowledgebases attached to this project providing context to the
                AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Storage Used: {((totalKbSize / maxKbSize) * 100).toFixed(1)}
                    %
                  </span>
                  <span className="text-muted-foreground">
                    {((1 - totalKbSize / maxKbSize) * 100).toFixed(1)}%
                    Available
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {kbs.map((kb) => (
                  <div
                    key={kb.id}
                    className="p-4 border rounded-lg flex justify-between items-center bg-card"
                  >
                    <div className="flex items-center">
                      <Database className="h-5 w-5 mr-3 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{kb.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {kb.documentCount} documents
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={ROUTES.KNOWLEDGEBASES.detail(kb.id)}>
                        Manage
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Link another Knowledgebase</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input defaultValue={project.name} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea defaultValue={project.description} />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button>Save Settings</Button>
              <Button variant="destructive">Delete Project</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
