"use client";

import { useBoundProp } from "@json-render/react";
import { type ReactNode, useId } from "react";
import { useGenerativeUIActions } from "@/components/chat/generative-ui/generative-ui-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function FieldWrapper({
  id,
  label,
  children,
}: {
  id: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
    </div>
  );
}

/**
 * Interactive form and action components for the Generative UI registry,
 * wired to local Shadcn primitives and `@json-render/react` state bindings.
 */
export const generativeUIInputComponents = {
  Button: ({
    props,
    emit,
    on,
  }: {
    props: {
      label: string;
      variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
      size?: "default" | "sm" | "lg";
      disabled?: boolean;
    };
    emit: (event: string) => void;
    on: (event: string) => { bound: boolean };
  }) => {
    const { sendMessage, isStreaming } = useGenerativeUIActions();
    const isActionBound = on("press").bound;
    const isDisabled =
      Boolean(props.disabled) ||
      (isActionBound && (isStreaming || !sendMessage));

    return (
      <Button
        type="button"
        variant={props.variant ?? "default"}
        size={props.size ?? "default"}
        disabled={isDisabled}
        onClick={() => emit("press")}
      >
        {props.label}
      </Button>
    );
  },

  Input: ({
    props,
    bindings,
  }: {
    props: {
      label?: string;
      placeholder?: string;
      type?: "text" | "number" | "email" | "password" | "search";
      value?: string;
    };
    bindings?: { value?: string };
  }) => {
    const id = useId();
    const [value, setValue] = useBoundProp<string>(
      props.value,
      bindings?.value,
    );
    return (
      <FieldWrapper id={id} label={props.label}>
        <Input
          id={id}
          type={props.type ?? "text"}
          placeholder={props.placeholder}
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      </FieldWrapper>
    );
  },

  Textarea: ({
    props,
    bindings,
  }: {
    props: {
      label?: string;
      placeholder?: string;
      rows?: number;
      value?: string;
    };
    bindings?: { value?: string };
  }) => {
    const id = useId();
    const [value, setValue] = useBoundProp<string>(
      props.value,
      bindings?.value,
    );
    return (
      <FieldWrapper id={id} label={props.label}>
        <Textarea
          id={id}
          rows={props.rows ?? 3}
          placeholder={props.placeholder}
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      </FieldWrapper>
    );
  },

  Select: ({
    props,
    bindings,
  }: {
    props: {
      label?: string;
      placeholder?: string;
      options: Array<{ label: string; value: string }>;
      value?: string;
    };
    bindings?: { value?: string };
  }) => {
    const id = useId();
    const [value, setValue] = useBoundProp<string>(
      props.value,
      bindings?.value,
    );
    return (
      <FieldWrapper id={id} label={props.label}>
        <Select value={value ?? ""} onValueChange={setValue}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={props.placeholder ?? "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldWrapper>
    );
  },

  Switch: ({
    props,
    bindings,
  }: {
    props: { label: string; checked?: boolean; description?: string };
    bindings?: { checked?: string };
  }) => {
    const id = useId();
    const [checked, setChecked] = useBoundProp<boolean>(
      props.checked,
      bindings?.checked,
    );
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor={id}>{props.label}</Label>
          {props.description && (
            <p className="text-muted-foreground text-xs">{props.description}</p>
          )}
        </div>
        <Switch
          id={id}
          checked={Boolean(checked)}
          onCheckedChange={(next) => setChecked(next)}
        />
      </div>
    );
  },

  Checkbox: ({
    props,
    bindings,
  }: {
    props: { label: string; checked?: boolean; description?: string };
    bindings?: { checked?: string };
  }) => {
    const id = useId();
    const [checked, setChecked] = useBoundProp<boolean>(
      props.checked,
      bindings?.checked,
    );
    return (
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={Boolean(checked)}
          onCheckedChange={(next) => setChecked(next === true)}
        />
        <div className="space-y-0.5 leading-none">
          <Label htmlFor={id}>{props.label}</Label>
          {props.description && (
            <p className="text-muted-foreground text-xs">{props.description}</p>
          )}
        </div>
      </div>
    );
  },

  Slider: ({
    props,
    bindings,
  }: {
    props: {
      label?: string;
      min?: number;
      max?: number;
      step?: number;
      value?: number;
    };
    bindings?: { value?: string };
  }) => {
    const id = useId();
    const [value, setValue] = useBoundProp<number>(
      props.value,
      bindings?.value,
    );
    const numericValue = typeof value === "number" ? value : (props.min ?? 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          {props.label ? <Label htmlFor={id}>{props.label}</Label> : <span />}
          <span className="font-mono font-medium tabular-nums">
            {numericValue}
          </span>
        </div>
        <Slider
          id={id}
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          value={numericValue}
          onValueChange={(next) => {
            const resolved = Array.isArray(next) ? next[0] : next;
            if (typeof resolved === "number") {
              setValue(resolved);
            }
          }}
        />
      </div>
    );
  },
};
