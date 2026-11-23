"use client";

import { Button } from "@/components/ui/button";
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
import type {
  WorkflowApprovalConfig,
  WorkflowNode,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowApprovalsTab}. */
export interface WorkflowApprovalsTabProps {
  approvalConfig: WorkflowApprovalConfig;
  onApprovalConfigChange: (config: WorkflowApprovalConfig) => void;
  nodes: WorkflowNode[];
  onToggleNodeReview: (nodeId: string, requiresReview: boolean) => void;
  availableTools: string[];
}

/**
 * Configures human review gates and per-tool execution approvals across the workflow.
 */
export function WorkflowApprovalsTab({
  approvalConfig,
  onApprovalConfigChange,
  nodes,
  onToggleNodeReview,
  availableTools,
}: WorkflowApprovalsTabProps) {
  const reviewableNodes = nodes.filter(
    (node) => node.data.kind === "ai_step" || node.data.kind === "http_request",
  );

  const toggleAutoApprovedTool = (toolName: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...approvalConfig.autoApprovedTools, toolName])]
      : approvalConfig.autoApprovedTools.filter((item) => item !== toolName);
    onApprovalConfigChange({ ...approvalConfig, autoApprovedTools: next });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Approvals &amp; Review Gates</h3>
        <p className="text-muted-foreground text-sm">
          Control when runs pause for human verification or tool execution
          approval.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label>Default Tool Approval Policy</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={
                approvalConfig.toolApprovalMode === "auto"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                onApprovalConfigChange({
                  ...approvalConfig,
                  toolApprovalMode: "auto",
                })
              }
            >
              Auto-Run Tools
            </Button>
            <Button
              type="button"
              variant={
                approvalConfig.toolApprovalMode === "ask"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                onApprovalConfigChange({
                  ...approvalConfig,
                  toolApprovalMode: "ask",
                })
              }
            >
              Ask Before Running
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Default Node Review Gate</Label>
          <Select
            value={approvalConfig.defaultReviewGate}
            onValueChange={(value) =>
              onApprovalConfigChange({
                ...approvalConfig,
                defaultReviewGate:
                  value as WorkflowApprovalConfig["defaultReviewGate"],
              })
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default pause</SelectItem>
              <SelectItem value="before">Pause before running</SelectItem>
              <SelectItem value="after">Pause after completion</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Per-Node Review Gates</Label>
          {reviewableNodes.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Add AI Step or HTTP Request nodes to configure node review gates.
            </p>
          ) : (
            <div className="space-y-2 rounded-lg border p-3">
              {reviewableNodes.map((node) => {
                const checked = Boolean(
                  (node.data.kind === "ai_step" ||
                    node.data.kind === "http_request") &&
                    node.data.requiresReview,
                );
                return (
                  <div
                    key={node.id}
                    className="flex items-center justify-between py-1"
                  >
                    <div>
                      <p className="text-sm font-medium">{node.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {`{{${node.data.variableName}}}`}
                      </p>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(next) =>
                        onToggleNodeReview(node.id, next)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {availableTools.length > 0 && (
          <div className="space-y-3">
            <Label>Always Auto-Approved Tools</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {availableTools.map((tool) => (
                <label
                  key={tool}
                  className="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <Checkbox
                    checked={approvalConfig.autoApprovedTools.includes(tool)}
                    onCheckedChange={(checked) =>
                      toggleAutoApprovedTool(tool, Boolean(checked))
                    }
                  />
                  <span className="font-mono">{tool}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
