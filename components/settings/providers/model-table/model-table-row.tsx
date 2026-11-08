"use client";

import {
  Binary,
  CheckCircle2,
  CircleSlash,
  Edit2,
  MessageSquare,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ModelCapabilityBadges } from "@/components/settings/providers/model-table/model-capability-badges";
import { ModelContextCell } from "@/components/settings/providers/model-table/model-context-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiModelRow } from "@/types/provider/ai-model-row";

/**
 * Resolves the icon component for a model type.
 *
 * @param modelType - Target model type
 * @returns Lucide icon component
 * @author Maruf Bepary
 */
function getModelTypeIcon(modelType: string | null | undefined) {
  if (modelType === "embedding") return Binary;
  if (modelType === "both") return Sparkles;
  return MessageSquare;
}

/**
 * Represents model table row props.
 *
 * @author Maruf Bepary
 */
export type ModelTableRowProps = {
  model: AiModelRow;
  providerName: string;
  isSelected: boolean;
  isBusy: boolean;
  onToggleSelect: (id: string) => void;
  onToggleEnabled: (model: AiModelRow, checked: boolean) => void;
  onEdit: (model: AiModelRow) => void;
  onDelete: (model: AiModelRow) => void;
};

/**
 * Renders the model table row component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ModelTableRow({
  model,
  providerName,
  isSelected,
  isBusy,
  onToggleSelect,
  onToggleEnabled,
  onEdit,
  onDelete,
}: ModelTableRowProps) {
  const ModelTypeIcon = getModelTypeIcon(model.modelType);

  return (
    <TableRow data-state={isSelected && "selected"}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          disabled={isBusy}
          onCheckedChange={() => onToggleSelect(model.id)}
          aria-label={`Select ${model.label}`}
        />
      </TableCell>
      <TableCell className="max-w-[260px] md:max-w-[320px]">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate font-medium" title={model.label}>
            {model.label}
          </div>
          <div
            className="text-muted-foreground truncate font-mono text-xs"
            title={model.modelId}
          >
            {model.modelId}
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-[140px] truncate" title={providerName}>
        {providerName}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1 capitalize">
          <ModelTypeIcon className="size-3 shrink-0" />
          {model.modelType}
        </Badge>
      </TableCell>
      <TableCell>
        <ModelCapabilityBadges model={model} />
      </TableCell>
      <TableCell>
        <ModelContextCell model={model} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onToggleEnabled(model, !model.isEnabled)}
                aria-label={model.isEnabled ? "Disable model" : "Enable model"}
              >
                {model.isEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CircleSlash className="h-4 w-4 text-amber-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {model.isEnabled ? "Disable Model" : "Enable Model"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onEdit(model)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Model</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={isBusy}
                onClick={() => onDelete(model)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Model</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}
