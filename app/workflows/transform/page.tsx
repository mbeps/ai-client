import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, Zap } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import { TransformAgentCard } from "@/components/workflows/sheet-flow/transform-agent-card";

export default async function TransformAgentsPage() {
  const rows = await listTransformAgents();
  const agents = rows.map(transformAgentRowToStore);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Zap className="h-8 w-8 text-amber-500" />}
        title="Spreadsheets Automation"
        description="Manage your automated spreadsheet transformation agents."
        action={
          <Button asChild>
            <Link href={ROUTES.WORKFLOWS.TRANSFORM.new}>
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-1">
        {agents.map((agent) => (
          <TransformAgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Settings2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">No agents found</h2>
          <p className="mt-2 text-muted-foreground">
            Get started by creating your first transformation agent.
          </p>
          <Button className="mt-6" asChild>
            <Link href={ROUTES.WORKFLOWS.TRANSFORM.new}>
              <Plus className="mr-2 h-4 w-4" /> Create Agent
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
