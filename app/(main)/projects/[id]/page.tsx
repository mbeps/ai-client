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
import { useRef, useState } from "react";
import { toast } from "sonner";

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
  const updateProjectDb = useAppStore((state) => state.updateProjectDb);
  const deleteProjectDb = useAppStore((state) => state.deleteProjectDb);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!project) return <NotFoundMessage entity="Project" />;

  const handleNewChat = () => {
    const chatId = createChat(projectId);
    router.push(ROUTES.PROJECTS.chat(projectId, chatId));
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await updateProjectDb(projectId, {
        globalPrompt: promptRef.current?.value ?? project.globalPrompt,
      });
      toast.success("Global prompt saved");
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProjectDb(projectId, {
        name: nameRef.current?.value ?? project.name,
        description: descRef.current?.value ?? project.description,
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await deleteProjectDb(projectId);
      toast.success("Project deleted");
      router.push(ROUTES.PROJECTS.path);
    } catch {
      toast.error("Failed to delete project");
      setDeleting(false);
    }
  };

  const totalKbSize = kbs.reduce((acc, kb) => acc + kb.sizeBytes, 0);
  const maxKbSize =
    kbs.reduce((acc, kb) => acc + kb.maxSizeBytes, 0) || 100 * 1024 * 1024;
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
                ref={promptRef}
                defaultValue={project.globalPrompt}
                rows={10}
                placeholder="e.g., You are an expert code reviewer specializing in React."
              />
            </CardContent>
            <CardFooter>
              <Button onClick={handleSavePrompt} disabled={savingPrompt}>
                {savingPrompt ? "Saving..." : "Save Prompt"}
              </Button>
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
                <Input ref={nameRef} defaultValue={project.name} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea ref={descRef} defaultValue={project.description} />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
