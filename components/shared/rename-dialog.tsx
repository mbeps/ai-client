"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { renameSchema } from "@/schemas/shared-fields";
import type { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type RenameFormData = z.infer<typeof renameSchema>;

/**
 * Shared modal for renaming entities like chats, projects, or assistants.
 * Provides consistent validation and look-and-feel across the app.
 *
 * @param props.isOpen - Whether the dialog is visible.
 * @param props.onClose - Function called to dismiss the dialog.
 * @param props.initialValue - Existing name/title displayed in the input.
 * @param props.onConfirm - Callback triggered when the new name is submitted.
 * @param props.title - Optional heading for the dialog (defaults to "Rename").
 * @param props.label - Optional text for the input label.
 * @author Maruf Bepary
 */
export function RenameDialog({
  isOpen,
  onClose,
  initialValue,
  onConfirm,
  title = "Rename",
  label = "Name",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onConfirm: (newName: string) => Promise<void>;
  title?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<RenameFormData>({
    resolver: zodResolver(renameSchema),
    defaultValues: {
      name: initialValue,
    },
  });

  // Sync initialValue when dialog opens
  useEffect(() => {
    if (isOpen) {
      reset({ name: initialValue });
    }
  }, [isOpen, initialValue, reset]);

  const onSubmit = async (data: RenameFormData) => {
    if (data.name === initialValue) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await onConfirm(data.name);
      onClose();
    } catch (error) {
      console.error("Rename failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Enter a new name for the item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">{label}</Label>
              <Input
                id="rename-input"
                {...register("name")}
                placeholder="Enter new name..."
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isDirty}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
