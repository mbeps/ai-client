"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { createProvider } from "@/lib/actions/providers/create-provider";
import { updateProvider } from "@/lib/actions/providers/update-provider";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
import type { AiProviderRow } from "@/types/ai-provider-row";

type HeaderRow = { key: string; value: string };

type ProviderFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: AiProviderRow | null;
  onSaved?: () => void;
};

function parseHeaderRows(_headers: string | null): HeaderRow[] {
  if (!_headers) return [{ key: "", value: "" }];

  try {
    const parsed = JSON.parse(_headers) as Record<string, unknown>;
    const rows = Object.entries(parsed)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => ({ key, value: String(value) }));

    return rows.length > 0 ? rows : [{ key: "", value: "" }];
  } catch {
    return [{ key: "", value: "" }];
  }
}

function normaliseHeaderRows(rows: HeaderRow[]): Record<string, string> {
  return Object.fromEntries(
    rows
      .map((row) => [row.key.trim(), row.value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  );
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: ProviderFormDialogProps) {
  const isEdit = !!provider;
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [requiresKey, setRequiresKey] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([
    { key: "", value: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setName(provider?.name ?? "");
    setBaseUrl(provider?.baseUrl ?? "");
    setApiKey("");
    setRequiresKey(provider?.requiresKey ?? true);
    setIsEnabled(provider?.isEnabled ?? true);
    setHeaderRows(parseHeaderRows(provider?.headers ?? null));
  }, [open, provider]);

  const headersRecord = useMemo(
    () => normaliseHeaderRows(headerRows),
    [headerRows],
  );

  const canSave =
    name.trim().length > 0 && baseUrl.trim().length > 0 && !isSaving;

  const updateHeaderRow = (index: number, patch: Partial<HeaderRow>): void => {
    setHeaderRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addHeaderRow = (): void => {
    setHeaderRows((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeHeaderRow = (index: number): void => {
    setHeaderRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ key: "", value: "" }];
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim().length > 0 ? apiKey.trim() : undefined,
        headers: headersRecord,
        requiresKey,
        isEnabled,
      };

      if (isEdit && provider) {
        await updateProvider(provider.id, payload);
        toast.success("Provider updated");
      } else {
        await createProvider(payload);
        toast.success("Provider created");
      }

      invalidateProviderRegistryCache();
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save provider",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                <span>Edit Provider</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span>Add Provider</span>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure an OpenAI-compatible provider endpoint and optional
            credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. OpenRouter, Ollama, Groq"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-url">Base URL</Label>
            <Input
              id="provider-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Requires API key</p>
              <p className="text-xs text-muted-foreground">
                Disable for keyless providers such as local Ollama instances.
              </p>
            </div>
            <Switch checked={requiresKey} onCheckedChange={setRequiresKey} />
          </div>

          {requiresKey && (
            <div className="space-y-2">
              <Label htmlFor="provider-api-key">API Key</Label>
              <Input
                id="provider-api-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                placeholder={
                  isEdit ? "Leave empty to keep current key" : "sk-..."
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                Disabled providers stay configured but hidden from runtime
                routing.
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Headers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHeaderRow}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Header
              </Button>
            </div>
            <div className="space-y-2">
              {headerRows.map((row, index) => (
                <div
                  key={`${index}-${row.key}`}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={row.key}
                    onChange={(event) =>
                      updateHeaderRow(index, { key: event.target.value })
                    }
                    placeholder="Header name"
                  />
                  <Input
                    value={row.value}
                    onChange={(event) =>
                      updateHeaderRow(index, { value: event.target.value })
                    }
                    placeholder="Header value"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeHeaderRow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Create Provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
