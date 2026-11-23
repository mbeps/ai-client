"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { HttpRequestNodeData } from "@/types/workflows/workflow";

const HTTP_METHODS: HttpRequestNodeData["method"][] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

/** Props for {@link HttpRequestConfig}. */
export interface HttpRequestConfigProps {
  data: HttpRequestNodeData;
  onChange: (updates: Partial<HttpRequestNodeData>) => void;
}

/**
 * Node inspector configuration section for outbound HTTP Request nodes.
 */
export function HttpRequestConfig({ data, onChange }: HttpRequestConfigProps) {
  const handleAddHeader = () => {
    onChange({ headers: [...data.headers, { key: "", value: "" }] });
  };

  const handleUpdateHeader = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    onChange({
      headers: data.headers.map((header, idx) =>
        idx === index ? { ...header, [field]: value } : header,
      ),
    });
  };

  const handleRemoveHeader = (index: number) => {
    onChange({ headers: data.headers.filter((_, idx) => idx !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select
            value={data.method}
            onValueChange={(value) =>
              onChange({ method: value as HttpRequestNodeData["method"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="http-request-url">Request URL</Label>
          <Input
            id="http-request-url"
            value={data.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/v1/items"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Headers</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddHeader}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Header
          </Button>
        </div>
        {data.headers.map((header, index) => (
          <div key={`${index}`} className="flex items-center gap-2">
            <Input
              value={header.key}
              onChange={(e) => handleUpdateHeader(index, "key", e.target.value)}
              placeholder="Header-Name"
              className="text-xs"
            />
            <Input
              value={header.value}
              onChange={(e) =>
                handleUpdateHeader(index, "value", e.target.value)
              }
              placeholder="Value or {{var}}"
              className="text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveHeader(index)}
            >
              <Trash2 className="text-destructive h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {data.method !== "GET" && (
        <div className="space-y-1.5">
          <Label htmlFor="http-request-body">JSON / Request Body</Label>
          <Textarea
            id="http-request-body"
            rows={4}
            value={data.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder='{"summary": {{json step1.summary}}}'
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="http-timeout-ms">Timeout (ms)</Label>
        <Input
          id="http-timeout-ms"
          type="number"
          min={500}
          max={60000}
          value={data.timeoutMs ?? 15000}
          onChange={(e) =>
            onChange({ timeoutMs: Number(e.target.value) || 15000 })
          }
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="http-review-switch">Require Review Gate</Label>
          <p className="text-muted-foreground text-xs">
            Pause before executing or continuing past this HTTP request.
          </p>
        </div>
        <Switch
          id="http-review-switch"
          checked={Boolean(data.requiresReview)}
          onCheckedChange={(checked) => onChange({ requiresReview: checked })}
        />
      </div>
    </div>
  );
}
