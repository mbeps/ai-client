"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!value.trim() || value === initialValue) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await onConfirm(value);
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
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rename-input">{label}</Label>
            <Input
              id="rename-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter new name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !value.trim()}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
