import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InternalToolCard } from "@/components/settings/internal-tool-card";
import { PageContainer } from "@/components/shared/page-container";
import { groupToolsByCategory } from "@/config/tools";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Internal tools page — server component describing every tool registered inside the app.
 * Route: /settings/tools. Tools are grouped by the category recorded in the
 * catalogue. Read-only: the catalogue is static config, there is no per-tool
 * enable/disable record yet.
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
        icon={<Wrench className="size-8 text-primary" />}
        title="Tools"
        description="The tools built into the assistant. Connectors add more tools of their own."
      />

      {groups.map(([category, tools]) => (
        <section key={category} className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-semibold text-xl tracking-tight">{category}</h2>
            <span className="text-muted-foreground text-sm">
              {tools.length} {tools.length === 1 ? "tool" : "tools"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <InternalToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                availability={tool.availability}
              />
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}
