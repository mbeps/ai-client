"use client";

import { ChevronLeft, Command, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  PromptForm,
  type PromptFormValues,
} from "@/components/prompt/prompt-form";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { createPrompt } from "@/lib/actions/prompts/create-prompt";
import { useAppStore } from "@/lib/store";

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
    <div className="page-container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground transition-colors hover:text-foreground"
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
