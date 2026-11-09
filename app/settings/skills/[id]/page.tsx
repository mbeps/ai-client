"use client";

import { Download, FileCode, Globe, Settings, Shield } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteSkill } from "@/actions/skills/delete-skill";
import { exportSkillZip } from "@/actions/skills/export-skill";
import { updateSkill } from "@/actions/skills/update-skill";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { SkillDetailsTab } from "@/components/skill/skill-details-tab";
import { SkillEditorTab } from "@/components/skill/skill-editor-tab";
import { SkillExportTab } from "@/components/skill/skill-export-tab";
import { SkillScopeTab } from "@/components/skill/skill-scope-tab";
import { ROUTES } from "@/config/routes";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { addOrUpdateFile } from "@/lib/skills/add-or-update-file";
import { deleteFile } from "@/lib/skills/delete-file";
import { deleteFolderPath } from "@/lib/skills/delete-folder-path";
import { moveFile } from "@/lib/skills/move-file";
import { renameFilePath } from "@/lib/skills/rename-file-path";
import { renameFolderPath } from "@/lib/skills/rename-folder-path";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import { useAppStore } from "@/lib/store/use-app-store";
import { SKILL_DESCRIPTION_MAX_LENGTH } from "@/schemas/skill/skill";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Validates skill draft.
 *
 * @param name - Target name
 * @param content - Text content
 * @param description - Target description
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Performs download base64 zip.
 *
 * @param filename - Target filename
 * @param base64 - Target base64
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Custom hook that provides use skill directory state functionality.
 *
 * @param initialFiles - Initial collection of skill files
 * @param content - Text content
 * @param setContent - State setter callback for content
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
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
      const res = moveFile(files, sourcePath, targetFolder);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to move file");
        return;
      }
      const { files: updated, newPath } = res.value;
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

/**
 * Represents skill form state.
 *
 * @author Maruf Bepary
 */
type SkillFormState = {
  displayName: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  projectIds: string[];
  assistantIds: string[];
};

/**
 * Constructs initial skill form.
 *
 * @param skill - Target skill
 * @returns The resolved result
 * @author Maruf Bepary
 */
function buildInitialSkillForm(skill?: any): SkillFormState {
  if (!skill) {
    return {
      displayName: "",
      name: "",
      description: "",
      content: "",
      enabled: true,
      projectIds: [],
      assistantIds: [],
    };
  }

  return {
    displayName: skill.displayName || "",
    name: skill.name,
    description: skill.description || "",
    content: skill.content,
    enabled: skill.enabled,
    projectIds: skill.projectIds ?? [],
    assistantIds: skill.assistantIds ?? [],
  };
}

/**
 * Constructs skill update payload.
 *
 * @param form - Form state values
 * @param filesToSave - Collection of files to be persisted
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
    projectIds: form.projectIds,
    assistantIds: form.assistantIds,
    files: filesToSave,
  };
}

/**
 * Custom hook that provides use skill editor state functionality.
 *
 * @param skillId - Target skill id
 * @param initialSkill - Target initial skill
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
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
      const res = await updateSkill(skillId, payload);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to save skill");
        return;
      }

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
      const res = await deleteSkill(skillId);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to delete skill");
        setDeleting(false);
        return;
      }
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
      const res = await exportSkillZip(skillId);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to export skill bundle");
        return;
      }
      const { filename, base64 } = res.value;
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

/**
 * Renders the skill detail page content component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SkillDetailPageContent({
  skillId,
  skill,
}: {
  skillId: string;
  skill: any;
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

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
      <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="details">
            <Settings className="mr-2 h-4 w-4" />
            <span>Details</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="editor">
            <FileCode className="mr-2 h-4 w-4" />
            <span>Editor</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="scope">
            <Globe className="mr-2 h-4 w-4" />
            <span>Scope</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" />
            <span>Export</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="details" className="w-full flex-1 space-y-6">
          <SkillDetailsTab
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
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="editor" className="w-full flex-1 space-y-6">
          <SkillEditorTab
            files={directory.files}
            selectedFilePath={directory.selectedFilePath}
            onSelectFile={directory.setSelectedFilePath}
            activeContent={directory.activeContent}
            onChangeContent={directory.handleContentChange}
            onCreateFile={directory.handleCreateFile}
            onCreateFolder={directory.handleCreateFolder}
            onRenameFile={directory.handleRenameFile}
            onDeleteFile={directory.handleDeleteFile}
            onRenameFolder={directory.handleRenameFolder}
            onDeleteFolder={directory.handleDeleteFolder}
            onMoveFile={directory.handleMoveFile}
            emptyFolders={directory.emptyFolders}
            fileToMove={directory.fileToMove}
            onClearFileToMove={() => directory.setFileToMove(null)}
            isSkillMd={directory.isSkillMd}
            onSave={() => handleSave()}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="scope" className="w-full flex-1">
          <SkillScopeTab
            projectIds={form.projectIds}
            onProjectIdsChange={(ids) =>
              setForm((prev) => ({ ...prev, projectIds: ids }))
            }
            assistantIds={form.assistantIds}
            onAssistantIdsChange={(ids) =>
              setForm((prev) => ({ ...prev, assistantIds: ids }))
            }
            onSave={() => handleSave()}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="export" className="w-full flex-1">
          <SkillExportTab
            onExport={handleExport}
            isExporting={exporting}
            skillName={form.displayName || form.name}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="danger" className="w-full flex-1">
          <DangerZoneCard
            title="Danger Zone"
            description="Irreversible actions for this agent skill."
            consequences="Deleting this skill will permanently remove it from your skills library. This action cannot be undone."
            buttonLabel="Delete Skill"
            onDelete={() => setShowDeleteDialog(true)}
            isDeleting={deleting}
          />
        </SidebarTabsContent>
      </SidebarTabs>

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

  useResourceHydration(["projects", "assistants", "skills"]);

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
    return <EntityDetailSkeleton />;
  }

  if (!skill) notFound();

  return <SkillDetailPageContent skillId={skillId} skill={skill} />;
}
