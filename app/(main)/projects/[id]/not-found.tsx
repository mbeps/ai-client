import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-6xl font-bold text-muted-foreground">404</h2>
      <p className="text-xl font-semibold">Project not found</p>
      <p className="text-sm text-muted-foreground max-w-md">
        This project does not exist or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/projects">Back to projects</Link>
      </Button>
    </div>
  );
}
