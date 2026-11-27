"use client";

import {
  Activity,
  MoreVertical,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { EntityCard } from "@/components/shared/entity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getProviderDefinition } from "@/config/providers";
import { ROUTES } from "@/config/routes";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Represents provider card props.
 *
 * @author Maruf Bepary
 */
interface ProviderCardProps {
  provider: AiProviderRow;
  isBusy: boolean;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
  onSync: () => void;
}

/**
 * A specialized card for displaying and managing an AI Provider.
 * Displays provider name, base URL, and inline actions.
 * The edit (settings) icon navigates to the dedicated provider detail page.
 *
 * @param props.provider - The provider entity to display.
 * @param props.isBusy - Whether the provider is currently processing an action.
 * @param props.onDelete - Callback to delete the provider.
 * @param props.onToggle - Callback to enable/disable the provider.
 * @param props.onTest - Callback to test the provider connection.
 * @param props.onSync - Callback to sync available models from the provider.
 * @author Maruf Bepary
 */
export function ProviderCard({
  provider,
  isBusy,
  onDelete,
  onToggle,
  onTest,
  onSync,
}: ProviderCardProps) {
  const def = getProviderDefinition(provider.type);
  const supportsSync = def.discovery.supportsSync;

  return (
    <EntityCard
      horizontal
      className="hover:bg-muted/30 cursor-default border shadow-none"
      title={
        <span className="flex items-center gap-2">
          <span className="font-semibold">{provider.name}</span>
          <Badge variant="outline" className="font-normal">
            {def.label}
          </Badge>
          {def.isBeta && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 font-mono text-[10px]"
            >
              BETA
            </Badge>
          )}
        </span>
      }
      description={provider.baseUrl}
      rightActions={
        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isBusy}
                asChild
              >
                <Link href={ROUTES.SETTINGS.PROVIDERS.detail(provider.id)}>
                  <Settings2 className="h-4 w-4" />
                  <span className="sr-only">Edit Provider</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Provider</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onSync}
                disabled={isBusy || !supportsSync}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Sync Models</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {supportsSync
                ? "Sync Models"
                : "Model sync not supported — add models manually"}
            </TooltipContent>
          </Tooltip>

          <div className="ml-1 flex items-center border-l pl-2">
            <Switch
              checked={provider.isEnabled}
              onCheckedChange={onToggle}
              disabled={isBusy}
            />
          </div>
        </div>
      }
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isBusy}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTest}>
              <Activity className="mr-2 h-4 w-4" />
              Test Connection
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Provider
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
