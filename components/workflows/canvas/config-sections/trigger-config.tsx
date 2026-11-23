"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/routes";
import type {
  ManualTriggerNodeData,
  WebhookTriggerNodeData,
} from "@/types/workflows/workflow";

/** Props for {@link TriggerConfig}. */
export interface TriggerConfigProps {
  workflowId: string;
  webhookSecret?: string | null;
  data: ManualTriggerNodeData | WebhookTriggerNodeData;
  onChange: (
    updates: Partial<ManualTriggerNodeData> | Partial<WebhookTriggerNodeData>,
  ) => void;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
}

/**
 * Node inspector configuration section for Manual Trigger and Webhook Trigger nodes.
 */
export function TriggerConfig({
  workflowId,
  webhookSecret,
  data,
  onChange,
  onRegenerateWebhookSecret,
}: TriggerConfigProps) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (data.kind === "manual_trigger") {
    return (
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="manual-trigger-file-upload">
            Require File Upload on Run
          </Label>
          <p className="text-muted-foreground text-xs">
            Prompt user for input files before executing manually.
          </p>
        </div>
        <Switch
          id="manual-trigger-file-upload"
          checked={Boolean(data.requiresFileUpload)}
          onCheckedChange={(checked) =>
            onChange({ requiresFileUpload: checked })
          }
        />
      </div>
    );
  }

  const endpointPath = ROUTES.API.WEBHOOKS.workflow(workflowId || "new");

  const handleCopySecret = async () => {
    if (!webhookSecret) return;
    await navigator.clipboard?.writeText(webhookSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = async () => {
    if (!onRegenerateWebhookSecret) return;
    setIsRegenerating(true);
    try {
      await onRegenerateWebhookSecret();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Webhook Endpoint</Label>
        <div className="bg-muted/50 rounded-md border px-3 py-2 font-mono text-xs break-all">
          POST {endpointPath}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="webhook-secret-header">Secret Header Name</Label>
        <Input
          id="webhook-secret-header"
          value={data.secretHeaderName ?? "x-webhook-secret"}
          onChange={(e) => onChange({ secretHeaderName: e.target.value })}
          placeholder="x-webhook-secret"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Signing Secret</Label>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={webhookSecret ?? "Saved after first workflow save"}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!webhookSecret}
            onClick={handleCopySecret}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {onRegenerateWebhookSecret && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRegenerating}
              onClick={handleRegenerate}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate Secret
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="webhook-sample-payload">Sample JSON Payload</Label>
        <Textarea
          id="webhook-sample-payload"
          rows={4}
          value={data.samplePayload ?? ""}
          onChange={(e) => onChange({ samplePayload: e.target.value })}
          placeholder='{"event": "invoice.created"}'
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
