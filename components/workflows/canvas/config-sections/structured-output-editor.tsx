"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  StructuredOutputField,
  StructuredOutputFieldType,
  StructuredOutputSchema,
  StructuredOutputSubfield,
} from "@/types/workflows/workflow";

const FIELD_TYPE_OPTIONS: {
  value: StructuredOutputFieldType;
  label: string;
}[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "string_array", label: "List of Text" },
  { value: "number_array", label: "List of Numbers" },
  { value: "object_array", label: "List of Objects" },
];

const SUBFIELD_TYPE_OPTIONS: {
  value: StructuredOutputSubfield["type"];
  label: string;
}[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
];

interface StructuredOutputSchemaEditorProps {
  value: StructuredOutputSchema | undefined;
  onChange: (schema: StructuredOutputSchema) => void;
}

/**
 * Visual schema builder for AI step structured JSON output fields.
 */
export function StructuredOutputSchemaEditor({
  value,
  onChange,
}: StructuredOutputSchemaEditorProps) {
  const fields = value?.fields ?? [];

  const updateFields = (nextFields: StructuredOutputField[]) => {
    onChange({ fields: nextFields });
  };

  const handleAddField = () => {
    if (fields.length >= 30) return;
    updateFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        name: "",
        type: "string",
        description: "",
        required: true,
      },
    ]);
  };

  const handleUpdateField = (
    id: string,
    patch: Partial<StructuredOutputField>,
  ) => {
    updateFields(
      fields.map((field) => {
        if (field.id !== id) return field;
        const updated = { ...field, ...patch };
        if (patch.type === "object_array" && !updated.itemFields) {
          updated.itemFields = [];
        }
        return updated;
      }),
    );
  };

  const handleRemoveField = (id: string) => {
    updateFields(fields.filter((f) => f.id !== id));
  };

  const handleAddSubfield = (fieldId: string) => {
    updateFields(
      fields.map((field) => {
        if (field.id !== fieldId) return field;
        const current = field.itemFields ?? [];
        if (current.length >= 15) return field;
        return {
          ...field,
          itemFields: [
            ...current,
            {
              id: crypto.randomUUID(),
              name: "",
              type: "string",
              required: true,
            },
          ],
        };
      }),
    );
  };

  const handleUpdateSubfield = (
    fieldId: string,
    subfieldId: string,
    patch: Partial<StructuredOutputSubfield>,
  ) => {
    updateFields(
      fields.map((field) => {
        if (field.id !== fieldId) return field;
        return {
          ...field,
          itemFields: (field.itemFields ?? []).map((sf) =>
            sf.id === subfieldId ? { ...sf, ...patch } : sf,
          ),
        };
      }),
    );
  };

  const handleRemoveSubfield = (fieldId: string, subfieldId: string) => {
    updateFields(
      fields.map((field) => {
        if (field.id !== fieldId) return field;
        return {
          ...field,
          itemFields: (field.itemFields ?? []).filter(
            (sf) => sf.id !== subfieldId,
          ),
        };
      }),
    );
  };

  return (
    <div className="space-y-2.5 rounded-lg border p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Output Schema</Label>
        <span className="text-muted-foreground text-[11px]">
          {fields.length}/30 fields
        </span>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground py-2 text-center text-xs">
          No fields defined. Add at least one field.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="bg-muted/30 space-y-2 rounded-md border p-2"
            >
              <div className="flex items-center gap-1.5">
                <Input
                  value={field.name}
                  onChange={(e) =>
                    handleUpdateField(field.id, { name: e.target.value })
                  }
                  placeholder="fieldName"
                  className="h-7 flex-1 font-mono text-xs"
                />
                <Select
                  value={field.type}
                  onValueChange={(nextType) =>
                    handleUpdateField(field.id, {
                      type: nextType as StructuredOutputFieldType,
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove field"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemoveField(field.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={field.description ?? ""}
                  onChange={(e) =>
                    handleUpdateField(field.id, { description: e.target.value })
                  }
                  placeholder="Description (optional)"
                  className="h-7 flex-1 text-xs"
                />
                <label className="flex shrink-0 items-center gap-1.5 text-[11px]">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      handleUpdateField(field.id, { required: checked })
                    }
                  />
                  <span>Required</span>
                </label>
              </div>

              {field.type === "object_array" && (
                <div className="border-border/60 space-y-1.5 border-l-2 pl-2">
                  {(field.itemFields ?? []).map((sf) => (
                    <div key={sf.id} className="flex items-center gap-1">
                      <Input
                        value={sf.name}
                        onChange={(e) =>
                          handleUpdateSubfield(field.id, sf.id, {
                            name: e.target.value,
                          })
                        }
                        placeholder="itemField"
                        className="h-6 flex-1 font-mono text-[11px]"
                      />
                      <Select
                        value={sf.type}
                        onValueChange={(nextType) =>
                          handleUpdateSubfield(field.id, sf.id, {
                            type: nextType as StructuredOutputSubfield["type"],
                          })
                        }
                      >
                        <SelectTrigger className="h-6 w-[92px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBFIELD_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Switch
                        checked={sf.required}
                        onCheckedChange={(checked) =>
                          handleUpdateSubfield(field.id, sf.id, {
                            required: checked,
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove subfield"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemoveSubfield(field.id, sf.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 w-full text-[11px]"
                    disabled={(field.itemFields ?? []).length >= 15}
                    onClick={() => handleAddSubfield(field.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add item field
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-full text-xs"
        disabled={fields.length >= 30}
        onClick={handleAddField}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add field
      </Button>
    </div>
  );
}
