"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Database, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createKnowledgebase } from "@/actions/knowledgebases/create-knowledgebase";
import { PageHeader } from "@/components/page-header";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { PageContainer } from "@/components/shared/page-container";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/routes";
import { useUserModels } from "@/hooks/use-user-models";
import { createKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";

/**
 * Represents form values for new knowledgebase creation.
 *
 * @author Maruf Bepary
 */
type FormValues = z.infer<typeof createKnowledgebaseSchema>;

/**
 * Dedicated page for creating a new Knowledge Base.
 * Provides a full-page form layout replacing the previous modal dialog,
 * redirecting to the created knowledgebase detail page upon success.
 *
 * @author Maruf Bepary
 */
export default function NewKnowledgebasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const hasNoModels = !isModelsLoading && models.length === 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(createKnowledgebaseSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await createKnowledgebase({
        name: values.name,
        description: values.description || undefined,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to create knowledgebase");
        return;
      }
      toast.success("Knowledgebase created");
      router.push(ROUTES.KNOWLEDGEBASES.detail(res.value.id));
    } catch {
      toast.error("Failed to create knowledgebase");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer variant="default">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-foreground mb-4 -ml-2 transition-colors"
      >
        <Link href={ROUTES.KNOWLEDGEBASES.path}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Knowledgebases
        </Link>
      </Button>

      <PageHeader
        icon={<Database className="text-primary h-8 w-8" />}
        title="New Knowledgebase"
        description="Create a new knowledgebase to attach documents to projects, assistants, or automations."
      />

      {hasNoModels && (
        <div className="mt-6">
          <NoModelsAlertBanner message="No embedding models configured. Please set up a provider with embedding support to create knowledgebases." />
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 max-w-2xl space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Knowledgebase" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What is this knowledgebase about?"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" asChild disabled={isSubmitting}>
              <Link href={ROUTES.KNOWLEDGEBASES.path}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isModelsLoading || hasNoModels}
            >
              <LoadingSwap isLoading={isSubmitting}>
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Knowledgebase
                </div>
              </LoadingSwap>
            </Button>
          </div>
        </form>
      </Form>
    </PageContainer>
  );
}
