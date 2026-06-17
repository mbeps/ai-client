"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createKnowledgebase } from "@/lib/actions/knowledgebases/create-knowledgebase";
import { toast } from "sonner";
import { Plus, X, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import { useUserModels } from "@/hooks/use-user-models";

type FormValues = z.infer<typeof createKnowledgebaseSchema>;

interface CreateKnowledgebaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateKnowledgebaseDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateKnowledgebaseDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { models } = useUserModels("embedding");
  const hasNoModels = models.length === 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(createKnowledgebaseSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await createKnowledgebase({
        name: values.name,
        description: values.description || undefined,
      });
      toast.success("Knowledgebase created");
      form.reset();
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch {
      toast.error("Failed to create knowledgebase");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Knowledgebase</DialogTitle>
          <DialogDescription>
            Create a new knowledgebase to attach documents to projects or
            assistants.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasNoModels && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-[11px] font-medium text-red-800 dark:text-red-200">
                  No embedding models configured. Please set up a provider
                  first.
                </p>
              </div>
            )}

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
              <Button type="submit" disabled={isSubmitting || hasNoModels}>
                {isSubmitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Knowledgebase
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
