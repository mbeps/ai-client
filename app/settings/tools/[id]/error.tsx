"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { RotateCcw, Wrench } from "lucide-react";

export default function ToolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold">Failed to load tool</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || "This tool could not be loaded. Please try again."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href={ROUTES.TOOLS.path}>
            <Wrench className="mr-2 h-4 w-4" />
            Back to tools
          </Link>
        </Button>
      </div>
    </div>
  );
}
