"use client";

import {
  BrainCircuit,
  Download,
  Files,
  Loader2,
  Settings,
  Shield,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { SkillGeneralTab } from "@/components/skill/skill-general-tab";
import { SkillSubfilesManager } from "@/components/skill/skill-subfiles-manager";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ROUTES } from "@/constants/routes";
import { deleteSkill } from "@/lib/actions/skills/delete-skill";
import { exportSkillZip } from "@/lib/actions/skills/export-skill";
import { updateSkill } from "@/lib/actions/skills/update-skill";
import { useAppStore } from "@/lib/store";
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
  const [displayName, setDisplayName] = useState(skill?.displayName ?? "");
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [content, setContent] = useState(skill?.content ?? "");
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);
  const [files, setFiles] = useState<SkillBundledFile[]>(skill?.files ?? []);

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

  if (!skill) {
    notFound();
  }

  const handleSave = async (updatedFiles?: SkillBundledFile[]) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) {
      toast.error("Skill slug is required");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanName)) {
      toast.error(
        "Skill slug can only contain lowercase letters, numbers, and hyphens",
      );
      return;
    }

    if (!content.trim()) {
      toast.error("Skill instructions content is required");
      return;
    }

    setSavingSettings(true);
    try {
      const filesToSave = updatedFiles ?? files;
      await updateSkill(skillId, {
        name: cleanName,
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        content,
        enabled,
        files: filesToSave,
      });

      if (updatedFiles) {
        setFiles(updatedFiles);
      }

      await loadSkills();
      toast.success("Skill saved");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to save skill");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveFiles = async (updatedFiles: SkillBundledFile[]) => {
    await handleSave(updatedFiles);
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

  return (
    <div className="page-container mx-auto max-w-4xl py-8">
      <PageHeader
        icon={<BrainCircuit className="h-8 w-8 text-primary" />}
        title={skill.displayName || skill.name}
        description={`Slash command: /${skill.name}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Export Bundle
            </Button>
          </div>
        }
      />

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            General
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="files">
            <Files className="mr-2 h-4 w-4" />
            Files ({files.length})
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            Danger Zone
          </SidebarTabsTrigger>
        </SidebarTabsList>

        {/* General Settings Tab */}
        <SidebarTabsContent value="general" className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div className="space-y-0.5">
              <label className="font-medium text-sm">Enable Skill</label>
              <p className="text-muted-foreground text-xs">
                When enabled, this skill will appear in slash commands and
                progressive disclosure tool calls.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <SkillGeneralTab
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            content={content}
            onContentChange={setContent}
            onSave={() => handleSave()}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        {/* Subfiles Management Tab */}
        <SidebarTabsContent value="files">
          <SkillSubfilesManager
            files={files}
            onSaveFiles={handleSaveFiles}
            isSaving={savingSettings}
          />
        </SidebarTabsContent>

        {/* Danger Zone Tab */}
        <SidebarTabsContent value="danger">
          <DangerZoneCard
            consequences="Deleting this skill will permanently remove it from your skills library and slash commands."
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
        title={`Delete "${skill.displayName || skill.name}"?`}
        description="This will permanently delete the agent skill. This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
