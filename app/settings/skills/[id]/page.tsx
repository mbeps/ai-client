"use client";

import { useAppStore } from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Trash2,
  BrainCircuit,
  Save,
  Settings,
  Files,
  FileCode,
  Plus,
  Download,
  Pencil,
  X,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { NotFoundMessage } from "@/components/not-found-message";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { updateSkill } from "@/lib/actions/skills/update-skill";
import { deleteSkill } from "@/lib/actions/skills/delete-skill";
import { exportSkillZip } from "@/lib/actions/skills/export-skill";
import { useQueryState, parseAsString } from "nuqs";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Skill editor page — view, edit, configure, and manage subfiles for an individual Agent Skill.
 *
 * @author Maruf Bepary
 */
export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("general").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const skills = useAppStore((state) => state.skills);
  const skill = skills.find((s) => s.id === skillId);
  const loadSkills = useAppStore((state) => state.loadSkills);

  const [loading, setLoading] = useState(skills.length === 0);
  const [name, setName] = useState(skill?.name ?? "");
  const [displayName, setDisplayName] = useState(skill?.displayName ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [content, setContent] = useState(skill?.content ?? "");
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);
  const [files, setFiles] = useState<SkillBundledFile[]>(
    (skill?.files as SkillBundledFile[]) ?? [],
  );

  // Subfile dialog state
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");

  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (skills.length === 0) {
      loadSkills().finally(() => setLoading(false));
    }
  }, [loadSkills, skills.length]);

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDisplayName(skill.displayName);
      setDescription(skill.description);
      setContent(skill.content);
      setEnabled(skill.enabled);
      setFiles((skill.files as SkillBundledFile[]) ?? []);
    }
  }, [skill]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill) return <NotFoundMessage entity="Skill" />;

  const handleSave = async (updatedFiles?: SkillBundledFile[]) => {
    if (
      !name.trim() ||
      !displayName.trim() ||
      !description.trim() ||
      !content.trim()
    ) {
      toast.error("Name, display name, description, and content are required");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name.trim())) {
      toast.error(
        "Skill slug must be lowercase alphanumeric with hyphens (e.g. clean-code)",
      );
      return;
    }

    const filesToSave = updatedFiles ?? files;

    setSavingSettings(true);
    try {
      await updateSkill(skillId, {
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        content,
        files: filesToSave,
        enabled,
      });
      await loadSkills();
      toast.success("Skill saved successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save skill");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportZip = async () => {
    setExporting(true);
    try {
      const { filename, base64 } = await exportSkillZip(skillId);
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filename}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export skill bundle");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSkill(skillId);
      await loadSkills();
      toast.success("Skill deleted");
      router.refresh();
      router.push(ROUTES.SETTINGS.SKILLS.path);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete skill");
      setDeleting(false);
    }
  };

  const openAddFileDialog = () => {
    setEditingFileIndex(null);
    setFilePath("");
    setFileContent("");
    setFileDialogOpen(true);
  };

  const openEditFileDialog = (index: number) => {
    const target = files[index];
    if (!target) return;
    setEditingFileIndex(index);
    setFilePath(target.path);
    setFileContent(target.content);
    setFileDialogOpen(true);
  };

  const handleSaveSubfile = () => {
    const cleanPath = filePath.trim().replace(/^\/+/, "");
    if (!cleanPath) {
      toast.error("File path is required (e.g. references/guide.md)");
      return;
    }

    if (cleanPath.toLowerCase() === "skill.md") {
      toast.error(
        "SKILL.md is the main instruction file. Edit it in General tab.",
      );
      return;
    }

    let updatedFiles: SkillBundledFile[];
    if (editingFileIndex !== null) {
      updatedFiles = files.map((f, i) =>
        i === editingFileIndex ? { path: cleanPath, content: fileContent } : f,
      );
    } else {
      // Check duplicates
      if (files.some((f) => f.path.toLowerCase() === cleanPath.toLowerCase())) {
        toast.error(`A subfile with path "${cleanPath}" already exists.`);
        return;
      }
      updatedFiles = [...files, { path: cleanPath, content: fileContent }];
    }

    setFiles(updatedFiles);
    setFileDialogOpen(false);
    handleSave(updatedFiles);
  };

  const handleDeleteSubfile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    handleSave(updatedFiles);
    toast.success("Subfile removed");
  };

  return (
    <div className="page-container max-w-4xl mx-auto py-8">
      <PageHeader
        icon={<BrainCircuit className="h-8 w-8 text-primary" />}
        title={skill.displayName || skill.name}
        description={`Agent Skill /${skill.name}`}
        action={
          <Button
            variant="outline"
            onClick={handleExportZip}
            disabled={exporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export Bundle (.zip)"}
          </Button>
        }
      />

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="files">
            <Files className="w-4 h-4 mr-2" />
            Subfiles ({files.length})
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Trash2 className="w-4 h-4 mr-2" />
            Danger Zone
          </SidebarTabsTrigger>
        </SidebarTabsList>

        {/* General Settings Tab */}
        <SidebarTabsContent value="general" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Skill Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Modify the skill name, progressive disclosure description, and
              instructions.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Skill</label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this skill will appear in slash commands and
                  progressive disclosure tool calls.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Skill Slug</label>
                <div className="flex items-center">
                  <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                    /
                  </div>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-l-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary used by AI for progressive disclosure routing..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Instructions & Guidelines (Markdown)
              </label>
              <MarkdownTabEditor
                value={content}
                onChange={setContent}
                minHeight="min-h-[300px]"
              />
            </div>
          </div>

          <div>
            <Button onClick={() => handleSave()} disabled={savingSettings}>
              {savingSettings ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </SidebarTabsContent>

        {/* Subfiles Management Tab */}
        <SidebarTabsContent value="files" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Bundled Subfiles</h3>
              <p className="text-sm text-muted-foreground">
                Supporting scripts, templates, or documentation bundled inside
                this skill package.
              </p>
            </div>
            <Button onClick={openAddFileDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Subfile
            </Button>
          </div>

          {files.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Files className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">No subfiles yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Add supporting reference markdown, code scripts, schemas, or
                    templates that the model can inspect when using this skill.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openAddFileDialog}
                  className="mt-2 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add First Subfile
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {files.map((file, idx) => (
                <Card key={idx} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-mono text-sm font-semibold truncate">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditFileDialog(idx)}
                        title="Edit subfile"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteSubfile(idx)}
                        title="Delete subfile"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-[240px] overflow-y-auto whitespace-pre-wrap">
                    {file.content}
                  </pre>
                </Card>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div>
              <Button onClick={() => handleSave()} disabled={savingSettings}>
                {savingSettings ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </SidebarTabsContent>

        {/* Danger Zone Tab */}
        <SidebarTabsContent value="danger">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this agent skill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this skill will permanently remove it from your skills
                library and slash commands.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Skill
              </Button>
            </CardContent>
          </Card>
        </SidebarTabsContent>
      </SidebarTabs>

      {/* Add / Edit Subfile Modal Dialog */}
      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFileIndex !== null ? "Edit Subfile" : "Add Subfile"}
            </DialogTitle>
            <DialogDescription>
              Specify the relative path inside the skill package (e.g.{" "}
              <code>references/guide.md</code>) and its contents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Relative File Path</label>
              <Input
                placeholder="references/guide.md"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">File Content</label>
              <MarkdownTabEditor
                placeholder="# Reference Documentation..."
                value={fileContent}
                onChange={setFileContent}
                minHeight="min-h-[250px]"
                maxHeight="max-h-[450px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFileDialogOpen(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSubfile}>
              <Save className="mr-2 h-4 w-4" />
              {editingFileIndex !== null ? "Update Subfile" : "Add Subfile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${skill.displayName || skill.name}"?`}
        description="This will permanently delete the agent skill. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
