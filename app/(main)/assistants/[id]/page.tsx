"use client";

import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
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
import { Input } from "@/components/ui/input";
import { useCreateChat } from "@/hooks/use-create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { ROUTES } from "@/lib/routes";
import { useAppStore } from "@/lib/store";
import {
  Bot,
  Loader2,
  MessageSquarePlus,
  MessageSquare,
  Settings,
  Save,
  Trash2,
  Search,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { ChatCard } from "@/components/chat/chat-card";

/**
 * Assistant detail page — client component for viewing and editing assistant configuration.
 * Route parameter: `[id]` — Unique assistant identifier.
 * Features: edit name/description/system prompt, view related chats, delete assistant, create new chats.
 * Shows 404 if assistant not found.
 *
 * @see AssistantChatPage for individual chat within an assistant
 */
export default function AssistantPage() {
  const params = useParams();
  const router = useRouter();
  const assistantId = params.id as string;

  const assistants = useAppStore((state) => state.assistants);
  const assistant = assistants.find((a) => a.id === assistantId);
  const allChats = useAppStore((state) => state.chats);
  const chats = Object.values(allChats).filter(
    (c) => c.assistantId === assistantId,
  );
  const createNewChat = useCreateChat();
  const updateAssistantDb = useAppStore((state) => state.updateAssistantDb);
  const deleteAssistantDb = useAppStore((state) => state.deleteAssistantDb);
  const loadAssistants = useAppStore((state) => state.loadAssistants);
  const loadChats = useAppStore((state) => state.loadChats);

  const [loading, setLoading] = useState(assistants.length === 0);
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [prompt, setPrompt] = useState(assistant?.prompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
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
    if (assistants.length === 0) {
      Promise.all([
        loadAssistants(),
        listChats()
          .then((rows) => loadChats(rows, []))
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (assistant) {
      setName(assistant.name);
      setDescription(assistant.description ?? "");
      setPrompt(assistant.prompt ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assistant?.id,
    assistant?.name,
    assistant?.description,
    assistant?.prompt,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistant) return <NotFoundMessage entity="Assistant" />;

  const handleNewChat = () => createNewChat("New Chat", undefined, assistantId);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssistantDb(assistantId, { name, description, prompt });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
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
    <div className="page-container">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{assistant.name}</h1>
            <p className="text-muted-foreground">{assistant.description}</p>
          </div>
        </div>
        <Button onClick={handleNewChat} size="lg" className="w-full md:w-auto">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Chat with Assistant
        </Button>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="mb-4 h-auto w-full flex-wrap md:w-fit">
          <TabsTrigger
            value="chats"
            className="flex h-auto flex-1 flex-col gap-1.5 px-2 py-2 whitespace-normal text-center md:flex-row md:py-1.5 md:whitespace-nowrap md:px-3"
          >
            <MessageSquare className="size-4" />
            <span>Chats</span>
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
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-9"
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
                    : "No chats with this assistant yet."
                }
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Customize the persona and capabilities of this assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="max-h-64"
                placeholder="e.g., You are a friendly helpful assistant."
              />
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Prompt
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assistant Details</CardTitle>
              <CardDescription>
                Manage the assistant name and description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assistant Name</label>
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
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Details
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this assistant will permanently remove it. This action
                cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Assistant
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${assistant.name}"?`}
        description="This will permanently delete the assistant. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
