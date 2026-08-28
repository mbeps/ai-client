"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { createSkill } from "@/lib/actions/skills/create-skill";
import { importSkillFile } from "@/lib/actions/skills/import-skill";
import { useAppStore } from "@/lib/store";
import { createSkillSchema } from "@/schemas/skill/skill";
import {
  BrainCircuit,
  ChevronLeft,
  FileArchive,
  FileText,
  CheckCircle2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { PageHeader } from "@/components/page-header";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const createSkillFormSchema = createSkillSchema.pick({
  name: true,
  displayName: true,
  description: true,
  content: true,
  enabled: true,
});

type FormValues = z.infer<typeof createSkillFormSchema>;
type FormInputValues = z.input<typeof createSkillFormSchema>;

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

  // Manual creation state
  const form = useForm<FormInputValues, undefined, FormValues>({
    resolver: zodResolver(createSkillFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      content: "",
      enabled: true,
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmitManual = async (values: FormValues) => {
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
    }
  };

  // Upload package state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".md") &&
      !name.endsWith(".zip") &&
      !name.endsWith(".txt")
    ) {
      toast.error("Please select a .md markdown file or a .zip skill bundle.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmitUpload = async () => {
    if (!selectedFile) return;

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
    <div className="page-container max-w-4xl mx-auto py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
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

        <SidebarTabsContent value="create" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Skill Details</h3>
            <p className="text-sm text-muted-foreground">
              Define the skill identifier, description for progressive
              disclosure routing, and instructions.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmitManual)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Clean Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Slug</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                            /
                          </div>
                          <Input
                            placeholder="clean-code"
                            className="rounded-l-none font-mono"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Lowercase letters, numbers, and hyphens only.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief summary used for routing and discovery"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions Content (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="# Skill\n\n## Role\nDescribe what this skill does..."
                        className="min-h-[300px] max-h-[600px] overflow-y-auto font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border p-4">
                    <div className="space-y-0.5 pr-4">
                      <FormLabel>Enabled</FormLabel>
                      <FormDescription>
                        Make this skill available immediately after creation.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(ROUTES.SETTINGS.SKILLS.path)}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <LoadingSwap isLoading={isSubmitting}>
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Skill
                    </div>
                  </LoadingSwap>
                </Button>
              </div>
            </form>
          </Form>
        </SidebarTabsContent>

        <SidebarTabsContent value="upload" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Import Skill Bundle</h3>
            <p className="text-sm text-muted-foreground">
              Import a <code>SKILL.md</code> file or a <code>.zip</code> bundle
              containing instructions and reference subfiles.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.zip,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
              selectedFile && "border-primary bg-primary/5",
            )}
          >
            {selectedFile ? (
              <>
                {selectedFile.name.endsWith(".zip") ? (
                  <FileArchive className="h-12 w-12 text-primary" />
                ) : (
                  <FileText className="h-12 w-12 text-primary" />
                )}
                <div className="space-y-1">
                  <p className="font-medium text-base text-foreground flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  Choose another file
                </Button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium">
                    Drop your skill file here, or{" "}
                    <span className="text-primary underline underline-offset-2">
                      browse
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports .md files with YAML frontmatter or .zip bundles
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(ROUTES.SETTINGS.SKILLS.path)}
              disabled={isUploading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={handleSubmitUpload}
            >
              <LoadingSwap isLoading={isUploading}>
                <div className="flex items-center">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Skill
                </div>
              </LoadingSwap>
            </Button>
          </div>
        </SidebarTabsContent>
      </SidebarTabs>
    </div>
  );
}
