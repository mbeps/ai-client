"use client";

import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  ArtifactCanvasType,
  WorkflowCanvasConfig,
} from "@/types/workflows/workflow";

const CANVAS_FORMAT_OPTIONS: Array<{
  value: ArtifactCanvasType;
  label: string;
}> = [
  { value: "markdown", label: "Markdown" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "html", label: "HTML" },
  { value: "mermaid", label: "Mermaid" },
];

/** Props for {@link WorkflowCanvasConfigTab}. */
export interface WorkflowCanvasConfigTabProps {
  canvasConfig: WorkflowCanvasConfig;
  onCanvasConfigChange: (config: WorkflowCanvasConfig) => void;
  latestArtifact?: ArtifactData | null;
}

/**
 * Configures Canvas artifact output permissions and renders the latest run preview.
 */
export function WorkflowCanvasConfigTab({
  canvasConfig,
  onCanvasConfigChange,
  latestArtifact,
}: WorkflowCanvasConfigTabProps) {
  const toggleAllowedType = (type: ArtifactCanvasType, checked: boolean) => {
    const next = checked
      ? [...new Set([...canvasConfig.allowedTypes, type])]
      : canvasConfig.allowedTypes.filter((item) => item !== type);
    const nextDefault =
      canvasConfig.defaultType &&
      canvasConfig.defaultType !== "any" &&
      !next.includes(canvasConfig.defaultType)
        ? "any"
        : canvasConfig.defaultType;
    onCanvasConfigChange({
      ...canvasConfig,
      allowedTypes: next,
      defaultType: nextDefault,
    });
  };

  const allowedFormatOptions = CANVAS_FORMAT_OPTIONS.filter((option) =>
    canvasConfig.allowedTypes.includes(option.value),
  );
  const selectedDefaultType =
    canvasConfig.defaultType &&
    (canvasConfig.defaultType === "any" ||
      canvasConfig.allowedTypes.includes(canvasConfig.defaultType))
      ? canvasConfig.defaultType
      : "any";

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Canvas Outputs</h3>
        <p className="text-muted-foreground text-sm">
          Choose which rich artifact formats AI steps can produce into the
          interactive Canvas preview pane.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="canvas-enabled-switch">
              Enable Canvas Artifacts
            </Label>
            <p className="text-muted-foreground text-xs">
              Allow steps to generate documents, spreadsheets, HTML apps, or
              diagrams.
            </p>
          </div>
          <Switch
            id="canvas-enabled-switch"
            checked={canvasConfig.enabled}
            onCheckedChange={(checked) =>
              onCanvasConfigChange({ ...canvasConfig, enabled: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="canvas-shared-switch">Shared Canvas Artifact</Label>
            <p className="text-muted-foreground text-xs">
              Allow sequential AI steps to read and modify the same Canvas
              artifact so the final step delivers a single combined result.
            </p>
          </div>
          <Switch
            id="canvas-shared-switch"
            checked={canvasConfig.sharedCanvas ?? true}
            disabled={!canvasConfig.enabled}
            onCheckedChange={(checked) =>
              onCanvasConfigChange({ ...canvasConfig, sharedCanvas: checked })
            }
          />
        </div>

        <div className="space-y-3">
          <Label>Allowed Output Formats</Label>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
            {CANVAS_FORMAT_OPTIONS.map((option) => {
              const inputId = `canvas-format-${option.value}`;
              const checked = canvasConfig.allowedTypes.includes(option.value);
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(val) =>
                      toggleAllowedType(option.value, Boolean(val))
                    }
                  />
                  <Label
                    htmlFor={inputId}
                    className="cursor-pointer font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Default Output Format</Label>
          <Select
            value={selectedDefaultType}
            onValueChange={(value) =>
              onCanvasConfigChange({
                ...canvasConfig,
                defaultType: value as WorkflowCanvasConfig["defaultType"],
              })
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Auto / Any Allowed</SelectItem>
              {allowedFormatOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {latestArtifact && (
        <div className="space-y-2">
          <Label>Latest Run Artifact Preview</Label>
          <div className="h-[480px] overflow-hidden rounded-lg border">
            <ArtifactPanel
              artifact={latestArtifact}
              isOpen={true}
              onClose={() => {}}
              isFullWidth={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
