"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createSkill } from "@/lib/actions/skills/create-skill";
import { useAppStore } from "@/lib/store";
import { createSkillSchema } from "@/schemas/skill/skill";
import { BrainCircuit, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const createSkillFormSchema = createSkillSchema.pick({
  name: true,
  displayName: true,
  description: true,
  content: true,
  enabled: true,
});

type FormValues = z.infer<typeof createSkillFormSchema>;
type FormInputValues = z.input<typeof createSkillFormSchema>;

interface CreateSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal form for creating a new Agent Skill.
 */
export function CreateSkillDialog({
  open,
  onOpenChange,
}: CreateSkillDialogProps) {
  const loadSkills = useAppStore((state) => state.loadSkills);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload = createSkillSchema.parse({
        ...values,
        files: [],
      });

      await createSkill(payload);
      toast.success("Skill created");
      await loadSkills();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create skill";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          form.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <DialogTitle>New Agent Skill</DialogTitle>
          </div>
          <DialogDescription>
            Create a skill with metadata and markdown instructions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="min-h-[220px] max-h-[420px] overflow-y-auto font-mono text-sm"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Skill
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
