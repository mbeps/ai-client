"use client";

import { ChevronLeft, Database, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createProvider } from "@/actions/providers/create-provider";
import { PageHeader } from "@/components/page-header";
import { ProviderFormFields } from "@/components/settings/providers/provider-form-fields";
import { PageContainer } from "@/components/shared/page-container";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { ROUTES } from "@/config/routes";
import { invalidateProviderRegistryCache } from "@/lib/providers/provider-registry-cache";

/**
 * Dedicated page for creating a new AI provider configuration.
 * Replaces the dialog-based flow with a full-page spacious layout,
 * consistent with the tools/new and prompts/new patterns.
 *
 * @author Maruf Bepary
 */
export default function NewProviderPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [requiresKey, setRequiresKey] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [headerRows, setHeaderRows] = useState<
    { key: string; value: string }[]
  >([{ key: "", value: "" }]);
  const [isSaving, setIsSaving] = useState(false);

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

      await createProvider({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim().length > 0 ? apiKey.trim() : undefined,
        headers,
        requiresKey,
        isEnabled,
      });

      invalidateProviderRegistryCache();
      toast.success("Provider created");
      router.push(ROUTES.SETTINGS.PROVIDERS.path);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create provider",
      );
    } finally {
      setIsSaving(false);
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
        title="Add Provider"
        description="Configure an OpenAI-compatible provider endpoint and optional credentials."
      />

      <div className="mt-6 space-y-6">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Provider Configuration</h3>
          <p className="text-muted-foreground text-sm">
            Set the provider name, API base URL, authentication key, and custom
            request headers.
          </p>
        </div>

        <ProviderFormFields
          name={name}
          baseUrl={baseUrl}
          apiKey={apiKey}
          requiresKey={requiresKey}
          isEnabled={isEnabled}
          headerRows={headerRows}
          isEdit={false}
          onNameChange={setName}
          onBaseUrlChange={setBaseUrl}
          onApiKeyChange={setApiKey}
          onRequiresKeyChange={setRequiresKey}
          onIsEnabledChange={setIsEnabled}
          onHeaderRowsChange={setHeaderRows}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link href={ROUTES.SETTINGS.PROVIDERS.path}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <LoadingSwap isLoading={isSaving}>
              <div className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </div>
            </LoadingSwap>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
