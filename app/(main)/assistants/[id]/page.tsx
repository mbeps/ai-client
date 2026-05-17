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
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PROMPTS } from "@/constants/prompts";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { ROUTES } from "@/constants/routes";
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
  FileText,
  Shield,
  Wrench,
} from "lucide-react";
import { ToolPickerList } from "@/components/chat/tool-picker-list";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useTabState } from "@/hooks/use-tab-state";
import { toast } from "sonner";
import { ChatCard } from "@/components/chat/chat-card";
import { updateAssistant } from "@/lib/actions/assistants/update-assistant";
import { deleteAssistant } from "@/lib/actions/assistants/delete-assistant";

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
  const loadAssistants = useAppStore((state) => state.loadAssistants);
  const loadChats = useAppStore((state) => state.loadChats);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const [loading, setLoading] = useState(assistants.length === 0);
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [prompt, setPrompt] = useState(assistant?.prompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(assistant?.tools || []),
  );
  const [tab, setTab] = useTabState("tab", "settings");

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
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (assistant) {
      setName(assistant.name);
      setDescription(assistant.description ?? "");
      setPrompt(assistant.prompt ?? "");
      setSelectedTools(new Set(assistant.tools || []));
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

  const onToggleTool = (serverId: string, toolName: string) => {
    const id = `${serverId}:tool:${toolName}`;
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onToggleResource = (serverId: string, uri: string) => {
    const id = `${serverId}:resource:${uri}`;
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onBulkSelect = (
    serverId: string,
    toolNames: string[],
    resourceUris: string[],
    select: boolean,
  ) => {
    if (select) {
      setSelectedTools((prev) => {
        const next = new Set(prev);
        toolNames.forEach((n) => next.add(`${serverId}:tool:${n}`));
        resourceUris.forEach((u) => next.add(`${serverId}:resource:${u}`));
        return next;
      });
    } else {
      setSelectedTools((prev) => {
        const next = new Set(prev);
        toolNames.forEach((n) => next.delete(`${serverId}:tool:${n}`));
        resourceUris.forEach((u) => next.delete(`${serverId}:resource:${u}`));
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssistant(assistantId, {
        name,
        description,
        prompt,
        tools: Array.from(selectedTools),
      });
      router.refresh();
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
      await deleteAssistant(assistantId);
      router.refresh();
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
      <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="chats">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chats</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="prompt">
            <FileText className="mr-2 h-4 w-4" />
            <span>Prompt</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            <span>Tools</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="chats" className="space-y-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">System Prompt</h3>
            <p className="text-sm text-muted-foreground">
              Customize the persona and capabilities of this assistant.
            </p>
          </div>
          <div className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              placeholder={
                PROMPTS.UI.EXAMPLES.ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_EDIT
              }
            />
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
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="settings" className="space-y-10">
          <section className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Assistant Details</h3>
              <p className="text-sm text-muted-foreground">
                Manage the assistant name and description.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assistant Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
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
            </div>
          </section>
        </SidebarTabsContent>

        <SidebarTabsContent value="tools" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Default Tools</h3>
            <p className="text-sm text-muted-foreground">
              Select tools and resources that should be enabled by default for
              all new chats with this assistant.
            </p>
          </div>
          <div className="space-y-4">
            <div className="border rounded-md max-h-[500px] overflow-hidden flex flex-col">
              <ToolPickerList
                servers={mcpServers.filter((s) => s.enabled)}
                selectedTools={selectedTools}
                selectedResources={selectedTools}
                onToggleTool={onToggleTool}
                onToggleResource={onToggleResource}
                onBulkSelect={onBulkSelect}
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Tools
                </>
              )}
            </Button>
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="danger">
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
        </SidebarTabsContent>
      </SidebarTabs>

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
