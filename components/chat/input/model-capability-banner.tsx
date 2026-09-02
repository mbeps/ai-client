"use client";

import { AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

/**
 * Props for ModelCapabilityBanner component.
 *
 * @author Maruf Bepary
 */
interface ModelCapabilityBannerProps {
  /** Whether all providers are disabled or no models are configured. */
  hasNoModels: boolean;
}

/**
 * Displays an alert banner when no AI models are available for chat.
 * Shows warning message and "Configure" link to provider settings.
 * Returns null if models are available (no rendering).
 *
 * @param hasNoModels - Whether all providers disabled or no models exist
 * @returns Warning banner with configure link, or null if models available
 * @author Maruf Bepary
 */
export function ModelCapabilityBanner({
  hasNoModels,
}: ModelCapabilityBannerProps) {
  if (!hasNoModels) return null;

  return (
    <div className="-mx-3 -mt-2 mb-2 flex items-center justify-between gap-3 rounded-t-xl border-amber-500/10 border-b bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 font-medium text-amber-600 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>All providers are disabled or no models found</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-amber-500/20 font-medium text-amber-600 text-xs hover:bg-amber-500/10"
        asChild
      >
        <Link href={ROUTES.SETTINGS.PROVIDERS.path}>
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Configure
        </Link>
      </Button>
    </div>
  );
}
