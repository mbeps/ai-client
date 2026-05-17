"use client";

import { useAppStore } from "@/lib/store";
import { PROMPTS } from "@/constants/prompts";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";

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
  Save,
  Trash2,
  Search,
  FileText,
  Shield,
  Wrench,
} from "lucide-react";
import { ToolPickerList } from "@/components/chat/tool-picker-list";

import { ROUTES } from "@/constants/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { EmptyState } from "@/components/empty-state";
import { ChatCard } from "@/components/chat/chat-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { deleteProject } from "@/lib/actions/projects/delete-project";
import { updateProject } from "@/lib/actions/projects/update-project";
import { useState, useEffect, useMemo } from "react";
import { useTabState } from "@/hooks/use-tab-state";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Project detail page — client component for viewing and editing project configuration.
 * Route parameter: `[id]` — Unique project identifier.
 * Features: edit name/description/global system prompt, view related chats, delete project, create new chats.
 * Shows 404 if project not found.
 *
 * @see ProjectChatPage for individual chat within a project
 */
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
  const loadProjects = useAppStore((state) => state.loadProjects);
  const loadChats = useAppStore((state) => state.loadChats);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const loadKnowledgebases = useAppStore((state) => state.loadKnowledgebases);

  const [loading, setLoading] = useState(projects.length === 0);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [globalPrompt, setGlobalPrompt] = useState(project?.globalPrompt ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(project?.tools || []),
  );
  const [selectedKbId, setSelectedKbId] = useState<string | null>(
    project?.knowledgebaseId ?? null,
  );
  const [savingKb, setSavingKb] = useState(false);
  const [tab, setTab] = useTabState("tab", "chats");

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
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
    if (knowledgebases.length === 0) {
      loadKnowledgebases().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setGlobalPrompt(project.globalPrompt ?? "");
      setSelectedTools(new Set(project.tools || []));
      setSelectedKbId(project.knowledgebaseId ?? null);
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

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProject(projectId, {
        name,
        description,
        globalPrompt,
        tools: Array.from(selectedTools),
      });
      router.refresh();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveKb = async () => {
    setSavingKb(true);
    try {
      await updateProject(projectId, { knowledgebaseId: selectedKbId });
      router.refresh();
      toast.success("Knowledge base saved");
    } catch {
      toast.error("Failed to save knowledge base");
    } finally {
      setSavingKb(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.refresh();
      toast.success("Project deleted");
      router.push(ROUTES.PROJECTS.path);
    } catch {
      toast.error("Failed to delete project");
      setDeleting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
        <Button onClick={handleNewChat} size="lg" className="w-full md:w-auto">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="chats">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chats</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledge">
            <Library className="mr-2 h-4 w-4" />
            <span>Knowledge</span>
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
                    : "No chats in this project yet."
                }
              />
            )}
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="knowledge" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Knowledge Base</h3>
            <p className="text-sm text-muted-foreground">
              Attach a knowledge base to provide context to the AI in all chats
              within this project.
            </p>
          </div>

          <div className="space-y-4">
            <Select
              value={selectedKbId ?? "none"}
              onValueChange={(v) => setSelectedKbId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No knowledge base selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {knowledgebases.map((kb) => (
                  <SelectItem key={kb.id} value={kb.id}>
                    {kb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSaveKb} disabled={savingKb}>
              {savingKb ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Knowledge Base
                </>
              )}
            </Button>
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Global Prompt</h3>
            <p className="text-sm text-muted-foreground">
              Instructions injected as system prompts for all new chats in this
              project.
            </p>
          </div>
          <div className="space-y-4">
            <Textarea
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
              rows={12}
              placeholder={
                PROMPTS.UI.EXAMPLES.PROJECT_GLOBAL_PROMPT_PLACEHOLDER_EDIT
              }
            />
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
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
              <h3 className="text-lg font-semibold">Project Details</h3>
              <p className="text-sm text-muted-foreground">
                Manage the project name and description.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
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
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? (
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
              all new chats in this project.
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

            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
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
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            </CardContent>
          </Card>
        </SidebarTabsContent>
      </SidebarTabs>

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
