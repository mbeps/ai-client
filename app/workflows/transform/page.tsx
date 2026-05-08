import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Settings2, PlayCircle, Zap } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";

export default async function TransformAgentsPage() {
  const rows = await listTransformAgents();
  const agents = rows.map(transformAgentRowToStore);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Zap className="h-8 w-8 text-amber-500" />}
        title="FloQast Transform"
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">{agent.name}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">
                {agent.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {agent.steps.length}
                </span>{" "}
                steps defined
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Last updated {agent.updatedAt.toLocaleDateString()}
              </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 border-t pt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                  <Settings2 className="mr-2 h-3.5 w-3.5" /> Configure
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                  <PlayCircle className="mr-2 h-3.5 w-3.5" /> Run
                </Link>
              </Button>
            </CardFooter>
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
