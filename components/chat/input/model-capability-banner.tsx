"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
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
    <div className="flex items-center justify-between gap-3 p-3 bg-amber-500/5 border-b border-amber-500/10 rounded-t-xl mb-2 -mx-3 -mt-2">
      <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
        <AlertCircle className="h-4 w-4" />
        <span>All providers are disabled or no models found</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs border-amber-500/20 hover:bg-amber-500/10 text-amber-600 font-medium"
        asChild
      >
        <Link href={ROUTES.SETTINGS.PROVIDERS.path}>Configure</Link>
      </Button>
    </div>
  );
}
