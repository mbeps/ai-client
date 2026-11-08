"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Represents a key-value pair for an HTTP header.
 *
 * @interface HeaderPair
 */
export interface HeaderPair {
  /** Unique client-side ID for stable React list rendering. */
  id: string;
  /** HTTP header name (e.g. X-Tenant-ID, Content-Type). */
  key: string;
  /** HTTP header value. */
  value: string;
}

/**
 * Props for HeaderPairsEditor component.
 *
 * @interface HeaderPairsEditorProps
 */
export interface HeaderPairsEditorProps {
  /** Array of header key-value pairs. */
  pairs: HeaderPair[];
  /** Callback fired when header pairs are added, modified, or removed. */
  onChange: (pairs: HeaderPair[]) => void;
  /** Whether the inputs are disabled (e.g. for installed community servers). */
  disabled?: boolean;
  /** Apply custom styling to inputs (edit form style). */
  styled?: boolean;
}

/**
 * Interactive key-value editor for custom HTTP request headers.
 * Replaces raw JSON textareas with structured name-value row inputs and row deletion.
 *
 * @param props - Component props
 * @author Maruf Bepary
 */
export function HeaderPairsEditor({
  pairs,
  onChange,
  disabled = false,
  styled = false,
}: HeaderPairsEditorProps) {
  const inputClass = styled ? "bg-background font-mono text-xs" : "text-xs";

  function handleAddPair() {
    onChange([
      ...pairs,
      {
        id: crypto.randomUUID(),
        key: "",
        value: "",
      },
    ]);
  }

  function handleUpdatePair(
    id: string,
    field: "key" | "value",
    newValue: string,
  ) {
    onChange(
      pairs.map((pair) =>
        pair.id === id ? { ...pair, [field]: newValue } : pair,
      ),
    );
  }

  function handleRemovePair(id: string) {
    onChange(pairs.filter((pair) => pair.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          Additional Headers
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPair}
          disabled={disabled}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="size-3.5" />
          <span>Add Header</span>
        </Button>
      </div>

      {pairs.length === 0 ? (
        <p className="text-muted-foreground/80 py-1 text-xs italic">
          No additional headers configured.
        </p>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair, index) => (
            <div key={pair.id} className="flex items-center gap-2">
              <Input
                placeholder="Header Name (e.g. X-Tenant-Id)"
                value={pair.key}
                disabled={disabled}
                onChange={(e) =>
                  handleUpdatePair(pair.id, "key", e.target.value)
                }
                className={`flex-1 ${inputClass}`}
                aria-label={`Header Name ${index + 1}`}
              />
              <Input
                placeholder="Header Value"
                value={pair.value}
                disabled={disabled}
                onChange={(e) =>
                  handleUpdatePair(pair.id, "value", e.target.value)
                }
                className={`flex-1 ${inputClass}`}
                aria-label={`Header Value ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemovePair(pair.id)}
                disabled={disabled}
                className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                aria-label={`Remove Header ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
