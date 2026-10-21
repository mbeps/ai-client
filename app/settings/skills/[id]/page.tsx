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

function validateSkillDraft(
  name: string,
  content: string,
  description: string,
): string | null {
  const cleanSlug = name.trim().toLowerCase();
  if (!cleanSlug) {
    return "Skill slug is required";
  }
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return "Skill slug can only contain lowercase letters, numbers, and hyphens";
  }
  if (!content.trim()) {
    return "Skill instructions content is required";
  }
  if (description.trim().length > SKILL_DESCRIPTION_MAX_LENGTH) {
    return `Skill description must be at most ${SKILL_DESCRIPTION_MAX_LENGTH} characters`;
  }
  return null;
}

function downloadBase64Zip(filename: string, base64: string): void {
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: "application/zip" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function useSkillDirectoryState(
  initialFiles: SkillBundledFile[],
  content: string,
  setContent: (val: string) => void,
) {
  const [files, setFiles] = useState<SkillBundledFile[]>(initialFiles);
  const [emptyFolders, setEmptyFolders] = useState<string[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("SKILL.md");
  const [fileToMove, setFileToMove] = useState<string | null>(null);

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

  return {
    files,
    setFiles,
    emptyFolders,
    selectedFilePath,
    setSelectedFilePath,
    fileToMove,
    setFileToMove,
    isSkillMd,
    activeContent,
    handleContentChange,
    handleCreateFile,
    handleCreateFolder,
    handleRenameFile,
    handleDeleteFile,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFile,
  };
}

type SkillFormState = {
  displayName: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
};

function buildInitialSkillForm(skill?: any): SkillFormState {
  if (!skill) {
    return {
      displayName: "",
      name: "",
      description: "",
      content: "",
      enabled: true,
    };
  }
  return {
    displayName: skill.displayName || "",
    name: skill.name,
    description: skill.description || "",
    content: skill.content,
    enabled: skill.enabled,
  };
}

function buildSkillUpdatePayload(
  form: SkillFormState,
  filesToSave: SkillBundledFile[],
) {
  const cleanDisplay = form.displayName.trim();
  const cleanDesc = form.description.trim();
  return {
    name: form.name.trim().toLowerCase(),
    displayName: cleanDisplay ? cleanDisplay : undefined,
    description: cleanDesc ? cleanDesc : undefined,
    content: form.content,
    enabled: form.enabled,
    files: filesToSave,
  };
}

function useSkillEditorState(skillId: string, initialSkill: any) {
  const router = useRouter();
  const loadSkills = useAppStore((state) => state.loadSkills);

  const [form, setForm] = useState<SkillFormState>(() =>
    buildInitialSkillForm(initialSkill),
  );

  const setContent = (val: string) => {
    setForm((prev) => ({ ...prev, content: val }));
  };

  const directory = useSkillDirectoryState(
    initialSkill?.files || [],
    form.content,
    setContent,
  );

  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!initialSkill) return;
    setForm(buildInitialSkillForm(initialSkill));
    directory.setFiles(initialSkill.files || []);
  }, [initialSkill, directory.setFiles]);

  const handleSave = async (updatedFiles?: SkillBundledFile[]) => {
    const validationError = validateSkillDraft(
      form.name,
      form.content,
      form.description,
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSavingSettings(true);
    try {
      const filesToSave = updatedFiles ? updatedFiles : directory.files;
      const payload = buildSkillUpdatePayload(form, filesToSave);
      await updateSkill(skillId, payload);

      if (updatedFiles) directory.setFiles(updatedFiles);
      await loadSkills();
      toast.success("Skill saved");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save skill");
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
      downloadBase64Zip(filename, base64);
      toast.success("Skill package downloaded");
    } catch {
      toast.error("Failed to export skill bundle");
    } finally {
      setExporting(false);
    }
  };

  return {
    form,
    setForm,
    directory,
    savingSettings,
    deleting,
    showDeleteDialog,
    setShowDeleteDialog,
    exporting,
    handleSave,
    handleDelete,
    handleExport,
  };
}

function SkillDetailPageContent({
  skillId,
  skill,
}: {
  skillId: string;
  skill: any;
}) {
  const {
    form,
    setForm,
    directory,
    savingSettings,
    deleting,
    showDeleteDialog,
    setShowDeleteDialog,
    exporting,
    handleSave,
    handleDelete,
    handleExport,
  } = useSkillEditorState(skillId, skill);

  return (
    <PageContainer variant="full" className="space-y-6">
      <SkillDetailHeader
        displayName={form.displayName}
        onDisplayNameChange={(val) =>
          setForm((prev) => ({ ...prev, displayName: val }))
        }
        name={form.name}
        onNameChange={(val) => setForm((prev) => ({ ...prev, name: val }))}
        description={form.description}
        onDescriptionChange={(val) =>
          setForm((prev) => ({ ...prev, description: val }))
        }
        enabled={form.enabled}
        onEnabledChange={(val) =>
          setForm((prev) => ({ ...prev, enabled: val }))
        }
        onSave={() => handleSave()}
        isSaving={savingSettings}
        onDelete={() => setShowDeleteDialog(true)}
        isDeleting={deleting}
        onExport={handleExport}
        isExporting={exporting}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkillFileEditor
            filePath={directory.selectedFilePath}
            content={directory.activeContent}
            onChangeContent={directory.handleContentChange}
            onRename={
              !directory.isSkillMd
                ? () => {
                    const newPath = prompt(
                      "Enter new file path:",
                      directory.selectedFilePath,
                    );
                    if (newPath)
                      directory.handleRenameFile(
                        directory.selectedFilePath,
                        newPath,
                      );
                  }
                : undefined
            }
            onMove={
              !directory.isSkillMd
                ? () => directory.setFileToMove(directory.selectedFilePath)
                : undefined
            }
            onDelete={
              !directory.isSkillMd
                ? () => directory.handleDeleteFile(directory.selectedFilePath)
                : undefined
            }
          />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <SkillDirectorySidebar
              files={directory.files}
              selectedPath={directory.selectedFilePath}
              onSelectFile={directory.setSelectedFilePath}
              onCreateFile={directory.handleCreateFile}
              onCreateFolder={directory.handleCreateFolder}
              onRenameFile={directory.handleRenameFile}
              onDeleteFile={directory.handleDeleteFile}
              onRenameFolder={directory.handleRenameFolder}
              onDeleteFolder={directory.handleDeleteFolder}
              onMoveFile={directory.handleMoveFile}
              emptyFolders={directory.emptyFolders}
              externalMoveFile={directory.fileToMove}
              onClearExternalMoveFile={() => directory.setFileToMove(null)}
            />
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${form.displayName || form.name}"?`}
        description="This will permanently delete the agent skill. This cannot be undone."
        loading={deleting}
      />
    </PageContainer>
  );
}

/**
 * Skill editor page — view, edit, configure, and manage directory hierarchy for an Agent Skill.
 *
 * @author Maruf Bepary
 */
export default function SkillDetailPage() {
  const params = useParams();
  const skillId = params.id as string;

  const skills = useAppStore((state) => state.skills);
  const skill = skills.find((s) => s.id === skillId);
  const loadSkills = useAppStore((state) => state.loadSkills);

  const [loading, setLoading] = useState(skills.length === 0);

  useEffect(() => {
    if (skills.length === 0) {
      loadSkills().finally(() => setLoading(false));
    }
  }, [loadSkills, skills.length]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill) notFound();

  return <SkillDetailPageContent skillId={skillId} skill={skill} />;
}
