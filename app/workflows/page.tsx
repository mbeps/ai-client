import { Languages, List } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

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
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">
          Select an automated workflow to get started.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((workflow) => (
          <Link key={workflow.name} href={workflow.href} className="group">
            <Card className="h-full overflow-hidden p-0 transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-lg bg-secondary/50 p-2 transition-colors group-hover:bg-secondary">
                    <workflow.icon className={`h-4 w-4 ${workflow.color}`} />
                  </div>
                  <CardTitle className="truncate font-semibold text-sm transition-colors group-hover:text-primary">
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
    </div>
  );
}
