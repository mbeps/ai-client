"use client";

import { useEffect, useRef } from "react";
import { useAutoExpandingTextarea } from "@/hooks/use-auto-expanding-textarea";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageEditFormProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Inline edit form for a user message.
 * Auto-focuses and auto-resizes the textarea on mount and value change.
 * Calls onSave with the current value; onCancel discards changes.
 *
 * @param props.value - Current textarea value.
 * @param props.onChange - Called on every keystroke.
 * @param props.onSave - Called when Save is clicked.
 * @param props.onCancel - Called when Cancel is clicked.
 */
export function MessageEditForm({
  value,
  onChange,
  onSave,
  onCancel,
}: MessageEditFormProps) {
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(
        editRef.current.value.length,
        editRef.current.value.length,
      );
    }
  }, []);

  useAutoExpandingTextarea(editRef, [value], 300);

  return (
    <div className="space-y-3">
      <Textarea
        ref={editRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] bg-background/50"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
