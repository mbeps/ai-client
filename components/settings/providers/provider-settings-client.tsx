"use client";

import { useMemo, useState } from "react";
import { Database, Boxes, Settings2, FileJson, Loader2 } from "lucide-react";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { useQueryState, parseAsString } from "nuqs";
import { useProviders } from "@/hooks/use-providers";
import { useUserModels } from "@/hooks/use-user-models";
import { ProviderList } from "@/components/settings/providers/provider-list";
import { ModelTable } from "@/components/settings/providers/model-table";
import { DefaultModelPicker } from "@/components/settings/providers/default-model-picker";
import { ImportExportPanel } from "@/components/settings/providers/import-export-panel";
import type { UserSettingsRow } from "@/types/user/user-settings-row";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";

type ProviderSettingsClientProps = {
  initialSettings: UserSettingsRow | null;
};

/**
 * Main client component for provider and model management in Settings.
 * Organizes tabs for Providers, Models, Default Models, and Import/Export.
 * Handles loading states and data refresh across all sub-components.
 *
 * @param props.initialSettings - Server-rendered user settings.
 * @author Maruf Bepary
 */
export function ProviderSettingsClient({
  initialSettings,
}: ProviderSettingsClientProps) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("providers").withOptions({
      shallow: true,
      history: "replace",
    }),
  );
  const [settings, setSettings] = useState<UserSettingsRow | null>(
    initialSettings,
  );
  const {
    providers,
    isLoading: providersLoading,
    refresh: refreshProviders,
  } = useProviders();
  const {
    rawModels,
    models: chatModels,
    isLoading: modelsLoading,
    refresh: refreshModels,
  } = useUserModels("chat");
  const { models: embeddingModels } = useUserModels("embedding");

  const isLoading = providersLoading || modelsLoading;

  const refreshAll = async (): Promise<void> => {
    const [nextSettings] = await Promise.all([
      getUserSettings(),
      refreshProviders(),
      refreshModels(),
    ]);
    setSettings(nextSettings);
  };

  return (
    <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
      <SidebarTabsList>
        <SidebarTabsTrigger value="providers">
          <Database className="mr-2 h-4 w-4" />
          <span>Providers</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="models">
          <Boxes className="mr-2 h-4 w-4" />
          <span>Models</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="defaults">
          <Settings2 className="mr-2 h-4 w-4" />
          <span>Defaults</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="registry">
          <FileJson className="mr-2 h-4 w-4" />
          <span>Registry</span>
        </SidebarTabsTrigger>
      </SidebarTabsList>

      <SidebarTabsContent value="providers" className="space-y-4">
        <ProviderList
          providers={providers}
          models={rawModels}
          onRefresh={refreshAll}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="models" className="space-y-4">
        <ModelTable
          models={rawModels}
          providers={providers}
          onRefresh={refreshAll}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="defaults" className="space-y-4">
        <DefaultModelPicker
          settings={settings}
          chatModels={chatModels}
          embeddingModels={embeddingModels}
          onRefresh={refreshAll}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="registry" className="space-y-4">
        <ImportExportPanel providers={providers} onRefresh={refreshAll} />
      </SidebarTabsContent>

      {/* Floating loading overlay to prevent layout shift */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            Syncing registry...
          </span>
        </div>
      )}
    </SidebarTabs>
  );
}
