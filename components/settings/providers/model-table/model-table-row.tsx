"use client";

import { Edit2, Trash2 } from "lucide-react";
import { ModelCapabilityBadges } from "@/components/settings/providers/model-table/model-capability-badges";
import { ModelContextCell } from "@/components/settings/providers/model-table/model-context-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiModelRow } from "@/types/provider/ai-model-row";

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
      <TableCell>
        <div className="space-y-0.5">
          <div className="font-medium">{model.label}</div>
          <div className="text-muted-foreground text-xs">{model.modelId}</div>
        </div>
      </TableCell>
      <TableCell>{providerName}</TableCell>
      <TableCell>
        <Badge variant="outline">{model.modelType}</Badge>
      </TableCell>
      <TableCell>
        <ModelCapabilityBadges model={model} />
      </TableCell>
      <TableCell>
        <ModelContextCell model={model} />
      </TableCell>
      <TableCell>
        <Switch
          checked={model.isEnabled}
          disabled={isBusy}
          onCheckedChange={(checked) => onToggleEnabled(model, checked)}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
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
