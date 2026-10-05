"use client";

import {
  ChevronLeft,
  Database,
  Loader2,
  Save,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteProvider } from "@/actions/providers/delete-provider";
import { updateProvider } from "@/actions/providers/update-provider";
import { PageHeader } from "@/components/page-header";
import { ProviderFormFields } from "@/components/settings/providers/provider-form-fields";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Switch } from "@/components/ui/switch";
import { ROUTES } from "@/config/routes";
import { useProviders } from "@/hooks/use-providers";
import { invalidateProviderRegistryCache } from "@/lib/providers/provider-registry-cache";

/** Converts a stored JSON headers string into key-value rows. */
function parseHeaderRows(raw: string | null): { key: string; value: string }[] {
  if (!raw) return [{ key: "", value: "" }];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rows = Object.entries(parsed)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => ({ key: k, value: String(v) }));
    return rows.length > 0 ? rows : [{ key: "", value: "" }];
  } catch {
    return [{ key: "", value: "" }];
  }
}

/**
 * Dedicated detail/edit page for an existing AI provider.
 * Route parameter: `[id]` — Unique provider identifier.
 * Features: edit all provider fields, toggle enabled state, danger zone delete.
 * Shows 404 if provider not found.
 *
 * @author Maruf Bepary
 * @see ProvidersPage for parent providers list
 */
export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const { providers, isLoading, refresh } = useProviders();
  const provider = providers.find((p) => p.id === providerId);

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("general").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [requiresKey, setRequiresKey] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [headerRows, setHeaderRows] = useState<
    { key: string; value: string }[]
  >([{ key: "", value: "" }]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Sync form state when provider loads
  useEffect(() => {
    if (!provider) return;
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiKey("");
    setRequiresKey(provider.requiresKey);
    setIsEnabled(provider.isEnabled);
    setHeaderRows(parseHeaderRows(provider.headers ?? null));
  }, [provider]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!provider) {
    notFound();
  }

  const canSave =
    name.trim().length > 0 && baseUrl.trim().length > 0 && !isSaving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;

    setIsSaving(true);
    try {
      const headers = Object.fromEntries(
        headerRows
          .map(({ key, value }) => [key.trim(), value.trim()] as const)
          .filter(([k, v]) => k.length > 0 && v.length > 0),
      );

      await updateProvider(providerId, {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim().length > 0 ? apiKey.trim() : undefined,
        headers,
        requiresKey,
        isEnabled,
      });

      invalidateProviderRegistryCache();
      await refresh();
      toast.success("Provider updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save provider",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await deleteProvider(providerId);
      invalidateProviderRegistryCache();
      toast.success("Provider deleted");
      router.push(ROUTES.SETTINGS.PROVIDERS.path);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete provider",
      );
      setIsDeleting(false);
    }
  };

  return (
    <PageContainer variant="default">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="mb-4 -ml-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Link href={ROUTES.SETTINGS.PROVIDERS.path}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Providers
        </Link>
      </Button>

      <PageHeader
        icon={<Database className="h-8 w-8 text-primary" />}
        title={provider.name}
        description={provider.baseUrl}
        action={
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="provider-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
              <Label htmlFor="provider-enabled" className="cursor-pointer">
                {isEnabled ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </div>
        }
      />

      <SidebarTabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuration</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="general" className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Provider Configuration</h3>
            <p className="text-muted-foreground text-sm">
              Update the provider name, API base URL, authentication key, and
              custom request headers.
            </p>
          </div>

          <ProviderFormFields
            name={name}
            baseUrl={baseUrl}
            apiKey={apiKey}
            requiresKey={requiresKey}
            isEnabled={isEnabled}
            headerRows={headerRows}
            isEdit
            onNameChange={setName}
            onBaseUrlChange={setBaseUrl}
            onApiKeyChange={setApiKey}
            onRequiresKeyChange={setRequiresKey}
            onIsEnabledChange={setIsEnabled}
            onHeaderRowsChange={setHeaderRows}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={!canSave}>
              <LoadingSwap isLoading={isSaving}>
                <div className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </div>
              </LoadingSwap>
            </Button>
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="danger">
          <DangerZoneCard
            title="Danger Zone"
            description="Irreversible actions for this provider."
            consequences="Deleting this provider will permanently remove it and all associated models. This action cannot be undone."
            buttonLabel="Delete Provider"
            onDelete={() => setShowDeleteDialog(true)}
            isDeleting={isDeleting}
          />
        </SidebarTabsContent>
      </SidebarTabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${provider.name}"?`}
        description="This will permanently delete the provider and all its associated models. This cannot be undone."
        loading={isDeleting}
      />
    </PageContainer>
  );
}
