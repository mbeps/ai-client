"use client";

import { ChevronLeft, Cpu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ModelEditorForm } from "@/components/settings/models/model-editor-form";
import { PageContainer } from "@/components/shared/page-container";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useProviders } from "@/hooks/use-providers";

/**
 * New Model page — allows creating a new AI model for any connected provider.
 * Features sidebar tabs for Details, Type, Context, Capabilities, and Configuration.
 *
 * @author Maruf Bepary
 */
export default function NewModelPage() {
  const router = useRouter();
  const { providers, isLoading } = useProviders();

  if (isLoading) {
    return <EntityDetailSkeleton />;
  }

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
        title="Add Model"
        description="Configure model capabilities, token limits, and routing metadata for a provider."
      />

      <ModelEditorForm
        providers={providers}
        onSuccess={() => {
          router.push(ROUTES.SETTINGS.MODELS.path);
        }}
      />
    </PageContainer>
  );
}
