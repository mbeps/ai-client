"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportProviderRegistry } from "@/lib/actions/providers/export-registry";
import { importProviderRegistry } from "@/lib/actions/providers/import-registry";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

type ImportExportPanelProps = {
  providers: AiProviderRow[];
  onRefresh: () => Promise<void>;
};

function downloadJson(filename: string, content: object): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Provides buttons to export and import the complete provider registry and model configurations.
 * Allows users to backup their setup or migrate between environments.
 *
 * @param props.providers - Current list of providers to include in export.
 * @param props.onRefresh - Callback to refresh after import.
 * @author Maruf Bepary
 */
export function ImportExportPanel({
  providers,
  onRefresh,
}: ImportExportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  const exportAll = async (): Promise<void> => {
    setIsBusy(true);
    try {
      const payload = await exportProviderRegistry();
      downloadJson("provider-registry.json", payload);
      toast.success("Registry exported");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export registry",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const exportSingleProvider = async (
    providerId: string,
    providerName: string,
  ): Promise<void> => {
    setIsBusy(true);
    try {
      const payload = await exportProviderRegistry({
        providerIds: [providerId],
      });
      downloadJson(
        `provider-${providerName.toLowerCase().replaceAll(" ", "-")}.json`,
        payload,
      );
      toast.success(`Exported ${providerName}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export provider",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const importFile = async (file: File): Promise<void> => {
    setIsBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await importProviderRegistry(parsed as never);
      invalidateProviderRegistryCache();
      await onRefresh();

      toast.success(
        `Imported: ${result.providersCreated} providers, ${result.modelsCreated} models`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import registry",
      );
    } finally {
      setIsBusy(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Import / Export</h3>
        <p className="text-sm text-muted-foreground">
          Export provider registry snapshots or import model/provider
          definitions.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void exportAll()}
            disabled={isBusy}
          >
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>

          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={isBusy}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void importFile(file);
            }}
          />
        </div>

        {providers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Per-provider export
            </p>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() =>
                    void exportSingleProvider(provider.id, provider.name)
                  }
                >
                  {provider.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
