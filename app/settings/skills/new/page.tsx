"use client";

import { BrainCircuit, ChevronLeft, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import {
  CreateSkillForm,
  type CreateSkillFormValues,
} from "@/components/skill/create-skill-form";
import { SkillBundleUploader } from "@/components/skill/skill-bundle-uploader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { createSkill } from "@/lib/actions/skills/create-skill";
import { importSkillFile } from "@/lib/actions/skills/import-skill";
import { useAppStore } from "@/lib/store";
import { createSkillSchema } from "@/schemas/skill/skill";

/**
 * Dedicated page for creating or importing Agent Skills.
 * Provides full-page tabs for manual skill authoring and Open Agent Skills package upload.
 *
 * @author Maruf Bepary
 */
export default function NewSkillPage() {
  const router = useRouter();
  const loadSkills = useAppStore((state) => state.loadSkills);

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("create").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const onSubmitManual = async (values: CreateSkillFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = createSkillSchema.parse({
        ...values,
        files: [],
      });

      await createSkill(payload);
      toast.success("Skill created");
      await loadSkills();
      router.push(ROUTES.SETTINGS.SKILLS.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create skill";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async (selectedFile: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await importSkillFile(formData);
      toast.success(
        `Skill "${result.displayName || result.name}" imported successfully!`,
      );
      await loadSkills();
      router.push(ROUTES.SETTINGS.SKILLS.path);
    } catch (err: any) {
      toast.error(err.message || "Failed to import skill");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="page-container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => router.push(ROUTES.SETTINGS.SKILLS.path)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Skills
      </Button>

      <PageHeader
        icon={<BrainCircuit className="h-8 w-8 text-primary" />}
        title="New Agent Skill"
        description="Create a skill with metadata and instructions, or upload an existing skill package."
      />

      <SidebarTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6 w-full"
      >
        <SidebarTabsList>
          <SidebarTabsTrigger value="create">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Skill</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload Package</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="create">
          <CreateSkillForm
            onSubmit={onSubmitManual}
            onCancel={() => router.push(ROUTES.SETTINGS.SKILLS.path)}
            isSubmitting={isSubmitting}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="upload">
          <SkillBundleUploader
            onUpload={handleUpload}
            onCancel={() => router.push(ROUTES.SETTINGS.SKILLS.path)}
            isUploading={isUploading}
          />
        </SidebarTabsContent>
      </SidebarTabs>
    </div>
  );
}
