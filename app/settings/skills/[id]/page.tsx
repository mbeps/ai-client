"use client";

import { Loader2 } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteSkill } from "@/actions/skills/delete-skill";
import { exportSkillZip } from "@/actions/skills/export-skill";
import { updateSkill } from "@/actions/skills/update-skill";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PageContainer } from "@/components/shared/page-container";
import { SkillDetailHeader } from "@/components/skill/skill-detail-header";
import { SkillDirectorySidebar } from "@/components/skill/skill-directory-sidebar";
import { SkillFileEditor } from "@/components/skill/skill-file-editor";
import { ROUTES } from "@/config/routes";
import {
  addOrUpdateFile,
  cleanPath,
  deleteFile,
  deleteFolderPath,
  moveFile,
  renameFilePath,
  renameFolderPath,
} from "@/lib/skills/skill-tree-utils";
import { useAppStore } from "@/lib/store";
import { SKILL_DESCRIPTION_MAX_LENGTH } from "@/schemas/skill/skill";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Skill editor page — view, edit, configure, and manage directory hierarchy for an Agent Skill.
 *
 * @author Maruf Bepary
 */
export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;

  const skills = useAppStore((state) => state.skills);
  const skill = skills.find((s) => s.id === skillId);
  const loadSkills = useAppStore((state) => state.loadSkills);

  const [loading, setLoading] = useState(skills.length === 0);
  const [displayName, setDisplayName] = useState(skill?.displayName ?? "");
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [content, setContent] = useState(skill?.content ?? "");
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);
  const [files, setFiles] = useState<SkillBundledFile[]>(skill?.files ?? []);
  const [emptyFolders, setEmptyFolders] = useState<string[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("SKILL.md");
  const [fileToMove, setFileToMove] = useState<string | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (skills.length === 0) {
      loadSkills().finally(() => setLoading(false));
    }
  }, [loadSkills, skills.length]);

  useEffect(() => {
    if (skill) {
      setDisplayName(skill.displayName ?? "");
      setName(skill.name);
      setDescription(skill.description ?? "");
      setContent(skill.content);
      setEnabled(skill.enabled);
      setFiles(skill.files ?? []);
    }
  }, [skill]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill) notFound();

  const handleSave = async (updatedFiles?: SkillBundledFile[]) => {
    const cleanSlug = name.trim().toLowerCase();
    if (!cleanSlug) {
      toast.error("Skill slug is required");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      toast.error(
        "Skill slug can only contain lowercase letters, numbers, and hyphens",
      );
      return;
    }
    if (!content.trim()) {
      toast.error("Skill instructions content is required");
      return;
    }
    if (description.trim().length > SKILL_DESCRIPTION_MAX_LENGTH) {
      toast.error(
        `Skill description must be at most ${SKILL_DESCRIPTION_MAX_LENGTH} characters`,
      );
      return;
    }

    setSavingSettings(true);
    try {
      const filesToSave = updatedFiles ?? files;
      await updateSkill(skillId, {
        name: cleanSlug,
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        content,
        enabled,
        files: filesToSave,
      });

      if (updatedFiles) setFiles(updatedFiles);
      await loadSkills();
      toast.success("Skill saved");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to save skill");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSkill(skillId);
      toast.success("Skill deleted");
      await loadSkills();
      router.refresh();
      router.push(ROUTES.SETTINGS.SKILLS.path);
    } catch {
      toast.error("Failed to delete skill");
      setDeleting(false);
    }
  };

  const handleExport = async () => {
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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Skill package downloaded");
    } catch {
      toast.error("Failed to export skill bundle");
    } finally {
      setExporting(false);
    }
  };

  const isSkillMd = selectedFilePath === "SKILL.md";
  const activeSubfile = files.find(
    (f) => cleanPath(f.path) === cleanPath(selectedFilePath),
  );
  const activeContent = isSkillMd ? content : (activeSubfile?.content ?? "");

  const handleContentChange = (val: string) => {
    if (isSkillMd) {
      setContent(val);
    } else {
      setFiles((prev) =>
        prev.map((f) =>
          cleanPath(f.path) === cleanPath(selectedFilePath)
            ? { ...f, content: val }
            : f,
        ),
      );
    }
  };

  const handleCreateFile = (path: string, initialContent = "") => {
    const updated = addOrUpdateFile(files, { path, content: initialContent });
    setFiles(updated);
    setSelectedFilePath(path);
  };

  const handleCreateFolder = (folderPath: string) => {
    setEmptyFolders((prev) =>
      Array.from(new Set([...prev, cleanPath(folderPath)])),
    );
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    const updated = renameFilePath(files, oldPath, newPath);
    setFiles(updated);
    if (cleanPath(selectedFilePath) === cleanPath(oldPath)) {
      setSelectedFilePath(newPath);
    }
  };

  const handleDeleteFile = (path: string) => {
    const updated = deleteFile(files, path);
    setFiles(updated);
    if (cleanPath(selectedFilePath) === cleanPath(path)) {
      setSelectedFilePath("SKILL.md");
    }
    toast.success(`File "${path}" deleted`);
  };

  const handleRenameFolder = (oldPrefix: string, newPrefix: string) => {
    const updated = renameFolderPath(files, oldPrefix, newPrefix);
    setFiles(updated);
    setEmptyFolders((prev) =>
      prev.map((f) => (f === oldPrefix ? newPrefix : f)),
    );
    const oldWithSlash = `${cleanPath(oldPrefix)}/`;
    if (cleanPath(selectedFilePath).startsWith(oldWithSlash)) {
      const rest = cleanPath(selectedFilePath).slice(oldWithSlash.length);
      setSelectedFilePath(`${cleanPath(newPrefix)}/${rest}`);
    }
  };

  const handleDeleteFolder = (folderPath: string) => {
    const updated = deleteFolderPath(files, folderPath);
    setFiles(updated);
    setEmptyFolders((prev) => prev.filter((f) => f !== cleanPath(folderPath)));
    const folderWithSlash = `${cleanPath(folderPath)}/`;
    if (cleanPath(selectedFilePath).startsWith(folderWithSlash)) {
      setSelectedFilePath("SKILL.md");
    }
  };

  const handleMoveFile = (sourcePath: string, targetFolder: string) => {
    try {
      const { files: updated, newPath } = moveFile(
        files,
        sourcePath,
        targetFolder,
      );
      setFiles(updated);
      if (cleanPath(selectedFilePath) === cleanPath(sourcePath)) {
        setSelectedFilePath(newPath);
      }
      toast.success(
        `Moved "${sourcePath}" to ${targetFolder ? `"${targetFolder}/"` : "root"}`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to move file");
    }
  };

  return (
    <PageContainer variant="full" className="space-y-6">
      {/* Simplified Page Header with Editable Title, Slash Command, Description, and Actions */}
      <SkillDetailHeader
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        enabled={enabled}
        onEnabledChange={setEnabled}
        onSave={() => handleSave()}
        isSaving={savingSettings}
        onDelete={() => setShowDeleteDialog(true)}
        isDeleting={deleting}
        onExport={handleExport}
        isExporting={exporting}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left Column: Editor without redundant box wrapper */}
        <div className="lg:col-span-2">
          <SkillFileEditor
            filePath={selectedFilePath}
            content={activeContent}
            onChangeContent={handleContentChange}
            onRename={
              !isSkillMd
                ? () => {
                    const newPath = prompt(
                      "Enter new file path:",
                      selectedFilePath,
                    );
                    if (newPath) handleRenameFile(selectedFilePath, newPath);
                  }
                : undefined
            }
            onMove={
              !isSkillMd ? () => setFileToMove(selectedFilePath) : undefined
            }
            onDelete={
              !isSkillMd ? () => handleDeleteFile(selectedFilePath) : undefined
            }
          />
        </div>

        {/* Right Column: Directory Structure */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <SkillDirectorySidebar
              files={files}
              selectedPath={selectedFilePath}
              onSelectFile={setSelectedFilePath}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveFile={handleMoveFile}
              emptyFolders={emptyFolders}
              externalMoveFile={fileToMove}
              onClearExternalMoveFile={() => setFileToMove(null)}
            />
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${displayName || name}"?`}
        description="This will permanently delete the agent skill. This cannot be undone."
        loading={deleting}
      />
    </PageContainer>
  );
}
