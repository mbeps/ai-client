"use client";

import { useAppStore } from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Library,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Settings,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { EmptyState } from "@/components/empty-state";
import { ChatCard } from "@/components/chat/chat-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useCreateChat } from "@/hooks/use-create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const projects = useAppStore((state) => state.projects);
  const project = projects.find((p) => p.id === projectId);
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.projectId === projectId,
  );
  const createNewChat = useCreateChat();
  const updateProjectDb = useAppStore((state) => state.updateProjectDb);
  const deleteProjectDb = useAppStore((state) => state.deleteProjectDb);
  const loadProjects = useAppStore((state) => state.loadProjects);
  const loadChats = useAppStore((state) => state.loadChats);

  const [loading, setLoading] = useState(projects.length === 0);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [globalPrompt, setGlobalPrompt] = useState(project?.globalPrompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const filteredChats = useMemo(() => {
    return chats
      .filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [chats, searchQuery]);

  useEffect(() => {
    if (projects.length === 0) {
      Promise.all([
        loadProjects(),
        listChats()
          .then((rows) => loadChats(rows, []))
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setGlobalPrompt(project.globalPrompt ?? "");
    }
  }, [project]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return <NotFoundMessage entity="Project" />;

  const handleNewChat = () => createNewChat("New Chat", projectId);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProjectDb(projectId, { name, description, globalPrompt });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
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

  return (
    <div className="page-container">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
        <Button onClick={handleNewChat} size="lg">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Tabs defaultValue="chats" className="w-full">
        <TabsList className="mb-4 h-auto w-full flex-wrap md:w-fit">
          <TabsTrigger
            value="chats"
            className="flex h-auto flex-1 flex-col gap-1.5 px-2 py-2 whitespace-normal text-center md:flex-row md:py-1.5 md:whitespace-nowrap md:px-3"
          >
            <MessageSquare className="size-4" />
            <span>Chats</span>
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="flex h-auto flex-1 flex-col gap-1.5 px-2 py-2 whitespace-normal text-center md:flex-row md:py-1.5 md:whitespace-nowrap md:px-3"
          >
            <Library className="size-4" />
            <span>Knowledge</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex h-auto flex-1 flex-col gap-1.5 px-2 py-2 whitespace-normal text-center md:flex-row md:py-1.5 md:whitespace-nowrap md:px-3"
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="space-y-4">
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredChats.map((chat) => (
              <ChatCard key={chat.id} chat={chat} />
            ))}
            {filteredChats.length === 0 && (
              <EmptyState
                message={
                  searchQuery
                    ? "No chats match your search."
                    : "No chats in this project yet."
                }
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge</CardTitle>
              <CardDescription>
                Attach knowledge bases to provide context to the AI in this
                project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Knowledge base support coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Global Prompt</CardTitle>
              <CardDescription>
                Instructions injected as system prompts for all new chats in
                this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={globalPrompt}
                onChange={(e) => setGlobalPrompt(e.target.value)}
                rows={8}
                placeholder="e.g., You are an expert code reviewer specializing in React."
              />
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Prompt"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Manage the project name and description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Details"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this project will permanently remove it. Chats will be
                dissociated but not deleted. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
              >
                Delete Project
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${project.name}"?`}
        description="This will permanently delete the project. Chats will be dissociated but not deleted. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
