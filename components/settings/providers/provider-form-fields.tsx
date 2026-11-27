"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getProviderDefinition,
  PROVIDER_CATALOG,
  type ProviderType,
} from "@/config/providers";

/**
 * Represents header row.
 *
 * @author Maruf Bepary
 */
type HeaderRow = { key: string; value: string };

/**
 * Represents provider form fields props.
 *
 * @author Maruf Bepary
 */
type ProviderFormFieldsProps = {
  providerType: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  requiresKey: boolean;
  isEnabled: boolean;
  headerRows: HeaderRow[];
  /** True when editing an existing provider; affects API key placeholder text. */
  isEdit: boolean;
  /** True when editing an existing provider that has custom headers saved. */
  hasSavedHeaders?: boolean;
  onProviderTypeChange?: (value: ProviderType) => void;
  onNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onRequiresKeyChange: (value: boolean) => void;
  onIsEnabledChange: (value: boolean) => void;
  onHeaderRowsChange: (rows: HeaderRow[]) => void;
};

/**
 * Shared form field set for provider create and edit pages.
 * Renders name, base URL, API key, requires-key toggle, enabled toggle,
 * and custom HTTP headers with add/remove support.
 *
 * @author Maruf Bepary
 */
export function ProviderFormFields({
  providerType,
  name,
  baseUrl,
  apiKey,
  requiresKey,
  isEnabled,
  headerRows,
  isEdit,
  hasSavedHeaders = false,
  onProviderTypeChange,
  onNameChange,
  onBaseUrlChange,
  onApiKeyChange,
  onRequiresKeyChange,
  onIsEnabledChange,
  onHeaderRowsChange,
}: ProviderFormFieldsProps) {
  const providerDef = getProviderDefinition(providerType);
  const defaultProviders = PROVIDER_CATALOG.filter((p) => p.tier === "default");
  const officialProviders = PROVIDER_CATALOG.filter(
    (p) => p.tier === "official",
  );
  const communityProviders = PROVIDER_CATALOG.filter(
    (p) => p.tier === "community",
  );
  const updateRow = (index: number, patch: Partial<HeaderRow>): void => {
    const next = [...headerRows];
    next[index] = { ...next[index], ...patch };
    onHeaderRowsChange(next);
  };

  const addRow = (): void => {
    onHeaderRowsChange([...headerRows, { key: "", value: "" }]);
  };

  const removeRow = (index: number): void => {
    const next = headerRows.filter((_, i) => i !== index);
    onHeaderRowsChange(next.length > 0 ? next : [{ key: "", value: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider-type">Provider Type</Label>
        {isEdit ? (
          <div className="bg-muted/40 flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <span>{providerDef.label}</span>
            {providerDef.isBeta && (
              <Badge
                variant="secondary"
                className="ml-auto px-1.5 py-0 font-mono text-[10px]"
              >
                BETA
              </Badge>
            )}
          </div>
        ) : (
          <Select
            value={providerType}
            onValueChange={(value) =>
              onProviderTypeChange?.(value as ProviderType)
            }
          >
            <SelectTrigger id="provider-type" className="w-full">
              <SelectValue placeholder="Select a provider type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Default</SelectLabel>
                {defaultProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Official Providers</SelectLabel>
                {officialProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Community (Beta)</SelectLabel>
                {communityProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex w-full items-center gap-2">
                      <span>{p.label}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto px-1.5 py-0 font-mono text-[10px]"
                      >
                        BETA
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider-name">Name</Label>
        <Input
          id="provider-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. OpenRouter, Ollama, Groq"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider-url">Base URL</Label>
        <Input
          id="provider-url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder={
            providerDef.defaultBaseUrl || "https://openrouter.ai/api/v1"
          }
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Requires API key</p>
          <p className="text-muted-foreground text-xs">
            Disable for keyless providers such as local Ollama instances.
          </p>
        </div>
        <Switch checked={requiresKey} onCheckedChange={onRequiresKeyChange} />
      </div>

      {requiresKey && (
        <div className="space-y-2">
          <Label htmlFor="provider-api-key">API Key</Label>
          <Input
            id="provider-api-key"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            type="password"
            placeholder={isEdit ? "Leave empty to keep current key" : "sk-..."}
          />
          <p className="text-muted-foreground text-xs">
            The key is encrypted before storage and can never be read back.
            Replace it to change it.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Enabled</p>
          <p className="text-muted-foreground text-xs">
            Disabled providers stay configured but hidden from runtime routing.
          </p>
        </div>
        <Switch checked={isEnabled} onCheckedChange={onIsEnabledChange} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Custom Headers</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Header
          </Button>
        </div>
        {isEdit && hasSavedHeaders && (
          <p className="text-muted-foreground text-xs">
            Custom headers are encrypted and cannot be read back. Leave empty to
            keep current headers, or enter new key-value pairs to replace them.
          </p>
        )}
        <div className="space-y-2">
          {headerRows.map((row, index) => (
            <div
              // stable enough — index + key prevents partial-key collisions
              key={`${index}-${row.key}`}
              className="flex items-center gap-2"
            >
              <Input
                value={row.key}
                onChange={(e) => updateRow(index, { key: e.target.value })}
                placeholder="Header name"
              />
              <Input
                value={row.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
                placeholder={
                  isEdit && hasSavedHeaders
                    ? "Saved — enter new value to replace"
                    : "Header value"
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
