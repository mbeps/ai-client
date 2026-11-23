import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InternalToolsGrid } from "@/components/settings/internal-tools-grid";
import { PageContainer } from "@/components/shared/page-container";
import { groupToolsByCategory } from "@/config/tools";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Internal tools page — server component describing every tool registered inside the app
 * and delegating interactive per-tool approval configuration to {@link InternalToolsGrid}.
 * Route: /settings/tools.
 *
 * @author Maruf Bepary
 * @see INTERNAL_TOOL_CATALOGUE in config/tools.ts for the source of truth.
 */
export default async function ToolsSettingsPage() {
  await requireSession();
  const groups = groupToolsByCategory();

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<Wrench className="text-primary size-8" />}
        title="Tools"
        description="Configure execution permissions for tools built into the assistant. Connectors add more tools of their own."
      />

      <InternalToolsGrid groups={groups} />
    </PageContainer>
  );
}
