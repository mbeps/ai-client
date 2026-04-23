import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { Wrench } from "lucide-react";

export default function ToolNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-6xl font-bold text-muted-foreground">404</h2>
      <p className="text-xl font-semibold">Tool not found</p>
      <p className="text-sm text-muted-foreground max-w-md">
        This MCP server does not exist or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href={ROUTES.TOOLS.path}>
          <Wrench className="mr-2 h-4 w-4" />
          Back to tools
        </Link>
      </Button>
    </div>
  );
}
