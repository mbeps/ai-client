import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Badge as UiBadge } from "@/components/ui/badge";
import {
  Card,
} from "@/components/ui/card";
import { Plus, Settings2, PlayCircle, Zap } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default async function TransformAgentsPage() {
  const rows = await listTransformAgents();
  const agents = rows.map(transformAgentRowToStore);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Zap className="h-8 w-8 text-amber-500" />}
        title="SheetFlow"
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
          <Card
            key={agent.id}
            className="flex flex-row items-center justify-between p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold truncate">{agent.name}</h3>
                <UiBadge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-medium"
                >
                  {agent.steps.length} {agent.steps.length === 1 ? "step" : "steps"}
                </UiBadge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {agent.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                    <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                      <Settings2 className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Configure Agent</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="h-8 w-8" asChild>
                    <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                      <PlayCircle className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Run Agent</TooltipContent>
              </Tooltip>
            </div>
          </Card>
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
