"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { syncProviderModels } from "@/actions/models/sync-provider-models";
import { deleteProvider } from "@/actions/providers/delete-provider";
import { testProviderConnection } from "@/actions/providers/test-provider-connection";
import { toggleProvider } from "@/actions/providers/toggle-provider";
import { ProviderCard } from "@/components/settings/providers/provider-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import { invalidateProviderRegistryCache } from "@/lib/providers/provider-registry-cache";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

type ProviderListProps = {
  providers: AiProviderRow[];
  models: AiModelRow[];
  onRefresh: () => Promise<void>;
};

/**
 * Lists all configured AI providers with search, toggle, test, sync, and delete controls.
 * Clicking a provider card's edit action navigates to the dedicated provider detail page.
 *
 * @param props.providers - Array of configured providers to display.
 * @param props.models - Array of models (for counting models per provider).
 * @param props.onRefresh - Callback to refresh the provider list after mutations.
 * @author Maruf Bepary
 */
export function ProviderList({
  providers,
  models,
  onRefresh,
}: ProviderListProps) {
  const [search, setSearch] = useState("");
  const [providerToDelete, setProviderToDelete] =
    useState<AiProviderRow | null>(null);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const _modelCountByProvider = useMemo(
    () =>
      models.reduce<Record<string, number>>((acc, model) => {
        acc[model.providerId] = (acc[model.providerId] ?? 0) + 1;
        return acc;
      }, {}),
    [models],
  );

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? providers.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.baseUrl.toLowerCase().includes(query),
        )
      : providers;

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [providers, search]);

  const runAction = async (
    providerId: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setBusyProviderId(providerId);
    try {
      await action();
      invalidateProviderRegistryCache();
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Provider action failed",
      );
    } finally {
      setBusyProviderId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search providers..."
          className="max-w-md"
        />
        <Button asChild>
          <Link href={ROUTES.SETTINGS.PROVIDERS.new}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Link>
        </Button>
      </div>

      {filteredProviders.length === 0 ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">No providers yet</CardTitle>
            <CardDescription>
              Add at least one provider before configuring models.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isBusy={busyProviderId === provider.id}
              onDelete={() => setProviderToDelete(provider)}
              onToggle={(checked) =>
                void runAction(provider.id, () =>
                  toggleProvider(provider.id, checked),
                )
              }
              onTest={() =>
                void runAction(provider.id, async () => {
                  const result = await testProviderConnection(provider.id);
                  if (!result.ok) {
                    throw new Error(result.error ?? "Connection failed");
                  }
                  toast.success("Connection successful");
                })
              }
              onSync={() =>
                void runAction(provider.id, async () => {
                  const result = await syncProviderModels(provider.id);
                  if (result.limitExceeded) {
                    toast.warning("Model Limit Reached", {
                      description: `Found ${result.totalDiscovered?.toLocaleString()} models; displaying first 1,000.`,
                    });
                  } else {
                    toast.success(
                      `Sync complete: +${result.added}, ${result.unchanged} unchanged`,
                    );
                  }
                })
              }
            />
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={!!providerToDelete}
        onClose={() => setProviderToDelete(null)}
        title="Delete Provider"
        description={`Are you sure you want to delete "${providerToDelete?.name}"? This will also delete all associated models and cannot be undone.`}
        loading={busyProviderId === providerToDelete?.id}
        onConfirm={async () => {
          if (!providerToDelete) return;
          await runAction(providerToDelete.id, async () => {
            await deleteProvider(providerToDelete.id);
            toast.success("Provider deleted");
            setProviderToDelete(null);
          });
        }}
      />
    </div>
  );
}
