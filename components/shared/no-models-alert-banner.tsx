import { AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";

interface NoModelsAlertBannerProps {
  message: string;
  className?: string;
}

export function NoModelsAlertBanner({
  message,
  className,
}: NoModelsAlertBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-xs font-medium text-red-800 dark:text-red-200">
          {message}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        asChild
        className="h-7 border-red-200 text-[10px] hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
      >
        <Link href={ROUTES.SETTINGS.PROVIDERS.path}>
          <Settings className="mr-1.5 h-3 w-3" />
          Go to Settings
        </Link>
      </Button>
    </div>
  );
}
