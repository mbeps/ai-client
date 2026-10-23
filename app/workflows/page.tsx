import { Languages, List } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/shared/page-container";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/config/routes";

const WORKFLOWS = [
  {
    name: "Translation",
    description:
      "Translate text or documents between multiple languages with high accuracy.",
    href: ROUTES.WORKFLOWS.TRANSLATION.path,
    icon: Languages,
    color: "text-blue-500",
  },
  {
    name: ROUTES.WORKFLOWS.TRANSFORM.name,
    description:
      "Automate multi-step transformations with AI and human review gates.",
    href: ROUTES.WORKFLOWS.TRANSFORM.path,
    icon: List,
    color: "text-amber-500",
  },
];

/**
 * Workflows hub page providing entry point to all available workflows.
 * Displays workflow types including Translation and Step-by-Step Automations.
 * Renders grid of workflow cards with descriptions and navigation links.
 *
 * @author Maruf Bepary
 */
export default function WorkflowsPage() {
  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">
          Select an automated workflow to get started.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((workflow) => (
          <Link key={workflow.name} href={workflow.href} className="group">
            <Card className="hover:border-primary/40 h-full overflow-hidden p-0 transition-all hover:shadow-md">
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-secondary/50 group-hover:bg-secondary shrink-0 rounded-lg p-2 transition-colors">
                    <workflow.icon className={`h-4 w-4 ${workflow.color}`} />
                  </div>
                  <CardTitle className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                    {workflow.name}
                  </CardTitle>
                </div>
                <div className="mt-2">
                  <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                    {workflow.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
