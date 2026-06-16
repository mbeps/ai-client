"use client";

import { EntityCard } from "@/components/shared/entity-card";
import { AiProviderRow } from "@/types/ai-provider-row";
import {
  Settings2,
  Trash2,
  Globe,
  MoreVertical,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProviderCardProps {
  provider: AiProviderRow;
  isBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
  onSync: () => void;
}

/**
 * A specialized card for displaying and managing an AI Provider.
 * Displays provider name, base URL, and actions for editing, deleting, and toggling.
 */
export function ProviderCard({
  provider,
  isBusy,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  onSync,
}: ProviderCardProps) {
  return (
    <EntityCard
      horizontal
      className="shadow-none border hover:bg-muted/30 cursor-default"
      icon={<Globe className="h-5 w-5 text-primary" />}
      title={<span className="font-semibold">{provider.name}</span>}
      description={provider.baseUrl}
      rightActions={
        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                disabled={isBusy}
              >
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Edit Provider</span>
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
                disabled={isBusy}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Sync Models</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync Models</TooltipContent>
          </Tooltip>

          <div className="flex items-center border-l pl-2 ml-1">
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
