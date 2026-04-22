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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  shortcut: z
    .string()
    .min(1, "Shortcut is required")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Only letters, numbers, '.', '-', and '_' are allowed",
    ),
  content: z.string().min(1, "Content is required"),
});

type FormValues = z.infer<typeof schema>;

interface CreatePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePromptDialog({
  open,
  onOpenChange,
}: CreatePromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPromptDb = useAppStore((state) => state.createPromptDb);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", shortcut: "", content: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await createPromptDb({
        title: values.title,
        shortcut: values.shortcut,
        content: values.content,
      });
      toast.success("Prompt created");
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create prompt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Prompt</DialogTitle>
          <DialogDescription>
            Create a custom prompt shortcut to quickly insert text into your chats.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Code Review Expert" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortcut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shortcut</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                          /
                        </div>
                        <Input
                          placeholder="brief"
                          className="rounded-l-none"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      The trigger command. Only letters, numbers, <code>.</code>,{" "}
                      <code>-</code>, and <code>_</code> allowed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="You are an expert at..."
                      className="min-h-[200px] max-h-[400px] overflow-y-auto"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The instructions that will be injected into your chat.
                  </FormDescription>
                  <FormMessage />
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
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Prompt"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
