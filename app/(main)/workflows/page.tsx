import { Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { listWorkflows } from "@/actions/workflows/list-workflows";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/shared/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowCard } from "@/components/workflows/editor/workflow-card";
import { ROUTES } from "@/config/routes";

/**
 * Visual DAG Workflows directory page listing all user-owned workflows.
 */
export default async function WorkflowsPage() {
  const res = await listWorkflows();
  const workflows = res.ok ? res.value : [];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<Workflow className="h-8 w-8 text-amber-500" />}
        title={ROUTES.WORKFLOWS.AUTOMATIONS.name}
        badge={
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300"
          >
            BETA
          </Badge>
        }
        description="Build and run visual multi-node AI workflows, branches, HTTP integrations, and interactive Canvas outputs."
        action={
          <Button asChild>
            <Link href={ROUTES.WORKFLOWS.AUTOMATIONS.new}>
              <Plus className="mr-2 h-4 w-4" />
              New Workflow
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {workflows.map((wf) => (
          <WorkflowCard key={wf.id} workflow={wf} />
        ))}
      </div>

      {workflows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="bg-muted rounded-full p-4">
            <Workflow className="text-muted-foreground h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">No workflows found</h2>
          <p className="text-muted-foreground mt-2">
            Get started by designing your first visual DAG workflow.
          </p>
          <Button className="mt-6" asChild>
            <Link href={ROUTES.WORKFLOWS.AUTOMATIONS.new}>
              <Plus className="mr-2 h-4 w-4" /> Create Workflow
            </Link>
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
