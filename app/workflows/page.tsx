import { ROUTES } from "@/constants/routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Languages, Zap } from "lucide-react";
import Link from "next/link";

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
    name: "Spreadsheets Automation",
    description:
      "Automate multi-step spreadsheet transformations with AI and human review gates.",
    href: ROUTES.WORKFLOWS.TRANSFORM.path,
    icon: Zap,
    color: "text-amber-500",
  },
];

/**
 * Workflows hub page providing entry point to all available workflows.
 * Displays workflow types including Translation and Spreadsheets Automation.
 * Renders grid of workflow cards with descriptions and navigation links.
 *
 * @author Maruf Bepary
 */

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">
          Select an automated workflow to get started.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((workflow) => (
          <Link key={workflow.name} href={workflow.href} className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/40 overflow-hidden p-0">
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors shrink-0">
                    <workflow.icon className={`h-4 w-4 ${workflow.color}`} />
                  </div>
                  <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {workflow.name}
                  </CardTitle>
                </div>
                <div className="mt-2">
                  <CardDescription className="text-xs leading-relaxed line-clamp-2">
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
