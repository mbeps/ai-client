"use client";

import { ChevronLeft, Cpu } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteModel } from "@/actions/models/delete-model";
import { PageHeader } from "@/components/page-header";
import { ModelEditorForm } from "@/components/settings/models/model-editor-form";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PageContainer } from "@/components/shared/page-container";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useProviders } from "@/hooks/use-providers";
import { useUserModels } from "@/hooks/use-user-models";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";

/**
 * Model detail / edit page — allows editing all attributes of an existing AI model.
 * Features sidebar tabs for Details, Type, Context, Capabilities, Configuration, and Danger Zone.
 *
 * @author Maruf Bepary
 */
export default function ModelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const modelId = params.id as string;

  const { providers, isLoading: providersLoading } = useProviders();
  const {
    rawModels,
    isLoading: modelsLoading,
    refresh: refreshModels,
  } = useUserModels("chat");

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isLoading = providersLoading || modelsLoading;
  const model = rawModels.find((m) => m.id === modelId);

  if (isLoading) {
    return <EntityDetailSkeleton />;
  }

  if (!model) {
    notFound();
    return null;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteModel(model.id);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to delete model");
        setIsDeleting(false);
        return;
      }
      invalidateProviderRegistryCache();
      toast.success("Model deleted");
      router.push(ROUTES.SETTINGS.MODELS.path);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete model",
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
        className="text-muted-foreground hover:text-foreground mb-4 -ml-2 transition-colors"
      >
        <Link href={ROUTES.SETTINGS.MODELS.path}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Models
        </Link>
      </Button>

      <PageHeader
        icon={<Cpu className="text-primary h-8 w-8" />}
        title={model.label || model.modelId}
        description={`Identifier: ${model.modelId} • Provider: ${model.providerName ?? "Custom"}`}
      />

      <ModelEditorForm
        model={model}
        providers={providers}
        onRequestDelete={() => setShowDeleteDialog(true)}
        isDeleting={isDeleting}
        onSuccess={() => {
          void refreshModels();
        }}
      />

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${model.label || model.modelId}"?`}
        description="This will permanently delete this model configuration. This cannot be undone."
        loading={isDeleting}
      />
    </PageContainer>
  );
}
