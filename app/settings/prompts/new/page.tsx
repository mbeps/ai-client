"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Command, Plus } from "lucide-react";
import { createPrompt } from "@/lib/actions/prompts/create-prompt";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import {
  PromptForm,
  type PromptFormValues,
} from "@/components/prompt/prompt-form";

/**
 * Dedicated page for creating a new custom prompt shortcut.
 * Provides a spacious editor layout for managing large prompt templates.
 *
 * @author Maruf Bepary
 */
export default function NewPromptPage() {
  const router = useRouter();
  const loadPrompts = useAppStore((state) => state.loadPrompts);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (values: PromptFormValues) => {
    setIsSubmitting(true);
    try {
      await createPrompt({
        title: values.title.trim(),
        shortcut: values.shortcut.trim(),
        content: values.content.trim(),
      });
      toast.success("Prompt created");
      await loadPrompts();
      router.push(ROUTES.SETTINGS.PROMPTS.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create prompt";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container max-w-4xl mx-auto py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => router.push(ROUTES.SETTINGS.PROMPTS.path)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Prompts
      </Button>

      <PageHeader
        icon={<Command className="h-8 w-8 text-primary" />}
        title="New Prompt"
        description="Create a custom prompt shortcut to quickly insert text into your chats."
      />

      <div className="mt-6">
        <PromptForm
          onSubmit={onSubmit}
          onCancel={() => router.push(ROUTES.SETTINGS.PROMPTS.path)}
          submitLabel="Create Prompt"
          submitIcon={<Plus className="mr-2 h-4 w-4" />}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
