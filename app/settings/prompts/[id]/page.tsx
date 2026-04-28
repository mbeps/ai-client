"use client";

import { useAppStore } from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
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
import { Loader2, Trash2, Command, Save } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";

/**
 * Prompt editor page — client component for viewing and editing a single prompt.
 * Route parameter: `[id]` — Unique prompt identifier.
 * Features: edit title/shortcut/content, save changes, delete prompt, validation and error handling.
 * Shows 404 if prompt not found.
 *
 * @see PromptsPage for parent prompts list
 */
export default function PromptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const promptId = params.id as string;

  const prompts = useAppStore((state) => state.prompts);
  const prompt = prompts.find((p) => p.id === promptId);

  const updatePromptDb = useAppStore((state) => state.updatePromptDb);
  const deletePromptDb = useAppStore((state) => state.deletePromptDb);
  const loadPrompts = useAppStore((state) => state.loadPrompts);

  const [loading, setLoading] = useState(prompts.length === 0);
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [shortcut, setShortcut] = useState(prompt?.shortcut ?? "/");
  const [content, setContent] = useState(prompt?.content ?? "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (prompts.length === 0) {
      loadPrompts().finally(() => setLoading(false));
    }
  }, [loadPrompts, prompts.length]);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setShortcut(prompt.shortcut);
      setContent(prompt.content);
    }
  }, [prompt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prompt) return <NotFoundMessage entity="Prompt" />;

  const handleSave = async () => {
    if (!title.trim() || !shortcut.trim() || !content.trim()) {
      toast.error("Title, shortcut, and content are required");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(shortcut)) {
      toast.error(
        "Shortcut can only contain letters, numbers, '.', '-', and '_'",
      );
      return;
    }

    setSavingSettings(true);
    try {
      await updatePromptDb(promptId, {
        title,
        shortcut,
        content,
      });
      toast.success("Prompt saved");
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePromptDb(promptId);
      toast.success("Prompt deleted");
      router.push(ROUTES.SETTINGS.PROMPTS.path);
    } catch {
      toast.error("Failed to delete prompt");
      setDeleting(false);
    }
  };

  return (
    <div className="page-container max-w-4xl mx-auto py-8">
      <PageHeader
        icon={<Command className="h-8 w-8 text-primary" />}
        title={prompt.title}
        description={`Edit shortcut: ${prompt.shortcut}`}
      />

      <div className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt Configuration</CardTitle>
            <CardDescription>
              Modify the prompt title, shortcut, and expansion text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shortcut</label>
                <div className="flex items-center">
                  <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                    /
                  </div>
                  <Input
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="brief"
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The trigger command. Only letters, numbers, <code>.</code>,{" "}
                  <code>-</code>, and <code>_</code> allowed.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] max-h-[500px] overflow-y-auto"
                placeholder="The instructions associated with this shortcut."
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={savingSettings}>
              {savingSettings ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for this prompt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting this prompt will permanently remove it from your
              shortcuts. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Prompt
            </Button>
          </CardContent>
        </Card>
      </div>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${prompt.title}"?`}
        description="This will permanently delete the prompt shortcut. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
