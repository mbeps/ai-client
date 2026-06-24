"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteProvider } from "@/lib/actions/providers/delete-provider";
import { toggleProvider } from "@/lib/actions/providers/toggle-provider";
import { testProviderConnection } from "@/lib/actions/providers/test-provider-connection";
import { syncProviderModels } from "@/lib/actions/models/sync-provider-models";
import { ProviderFormDialog } from "@/components/settings/providers/provider-form-dialog";
import { ProviderCard } from "@/components/settings/providers/provider-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { AiModelRow } from "@/types/provider/ai-model-row";

type ProviderListProps = {
  providers: AiProviderRow[];
  models: AiModelRow[];
  onRefresh: () => Promise<void>;
};

export function ProviderList({
  providers,
  models,
  onRefresh,
}: ProviderListProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProviderRow | null>(
    null,
  );
  const [providerToDelete, setProviderToDelete] =
    useState<AiProviderRow | null>(null);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const modelCountByProvider = useMemo(
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
      ? providers.filter((provider) => {
          return (
            provider.name.toLowerCase().includes(query) ||
            provider.baseUrl.toLowerCase().includes(query)
          );
        })
      : providers;

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [providers, search]);

  const openCreateDialog = (): void => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const openEditDialog = (provider: AiProviderRow): void => {
    setEditingProvider(provider);
    setDialogOpen(true);
  };

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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search providers..."
          className="max-w-md"
        />
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
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
        <div className="grid gap-4 grid-cols-1">
          {filteredProviders.map((provider) => {
            const isBusy = busyProviderId === provider.id;

            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isBusy={isBusy}
                onEdit={() => openEditDialog(provider)}
                onDelete={() => setProviderToDelete(provider)}
                onToggle={(checked) =>
                  void runAction(provider.id, async () => {
                    await toggleProvider(provider.id, checked);
                  })
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
            );
          })}
        </div>
      )}

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editingProvider}
        onSaved={() => {
          void onRefresh();
        }}
      />

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
