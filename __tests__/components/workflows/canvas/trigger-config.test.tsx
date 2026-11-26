import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TriggerConfig } from "@/components/workflows/canvas/config-sections/trigger-config";

describe("TriggerConfig", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders manual_trigger and toggles requiresFileUpload", () => {
    const onChange = vi.fn();
    render(
      <TriggerConfig
        kind="manual_trigger"
        data={{
          kind: "manual_trigger",
          variableName: "trigger",
          requiresFileUpload: false,
        }}
        onChange={onChange}
      />,
    );

    const toggle = screen.getByRole("switch", {
      name: /Require File Upload on Run/i,
    });
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ requiresFileUpload: true });
  });

  it("renders webhook_trigger, handles copy secret, regenerate, and sample payload", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const onChange = vi.fn();
    const onRegenerate = vi.fn().mockResolvedValue(undefined);

    render(
      <TriggerConfig
        kind="webhook_trigger"
        workflowId="wf-1"
        webhookSecret="sec-123"
        onRegenerateWebhookSecret={onRegenerate}
        data={{
          kind: "webhook_trigger",
          variableName: "webhook",
          secretHeaderName: "x-custom-secret",
          samplePayload: "",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText((t) => t.startsWith("POST "))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Secret Header Name/i), {
      target: { value: "x-new-secret" },
    });
    expect(onChange).toHaveBeenCalledWith({ secretHeaderName: "x-new-secret" });

    fireEvent.change(screen.getByLabelText(/Sample JSON Payload/i), {
      target: { value: '{"ok":true}' },
    });
    expect(onChange).toHaveBeenCalledWith({ samplePayload: '{"ok":true}' });

    const buttons = screen.getAllByRole("button");
    // buttons[0] is copy, buttons[1] is regenerate
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(writeText).toHaveBeenCalledWith("sec-123");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      fireEvent.click(buttons[1]);
    });
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("renders webhook_trigger with fallback workflowId and no secret", () => {
    render(
      <TriggerConfig
        kind="webhook_trigger"
        data={{
          kind: "webhook_trigger",
          variableName: "webhook",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText((t) => t.startsWith("POST "))).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Saved after first workflow save"),
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
  });
});
