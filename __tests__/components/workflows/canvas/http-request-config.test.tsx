import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpRequestConfig } from "@/components/workflows/canvas/config-sections/http-request-config";

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="http-method-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

describe("HttpRequestConfig", () => {
  it("handles method, url, headers add/update/remove, body, timeout, and review switch", () => {
    const onChange = vi.fn();
    render(
      <HttpRequestConfig
        data={{
          kind: "http_request",
          variableName: "http1",
          method: "POST",
          url: "https://example.com",
          headers: [
            { key: "Authorization", value: "Bearer 1" },
            { key: "X-Custom", value: "abc" },
          ],
          body: '{"a":1}',
          timeoutMs: 5000,
          requiresReview: false,
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Request URL/i), {
      target: { value: "https://api.example.com/v2" },
    });
    expect(onChange).toHaveBeenCalledWith({ url: "https://api.example.com/v2" });

    fireEvent.click(screen.getByRole("button", { name: /Add Header/i }));
    expect(onChange).toHaveBeenCalledWith({
      headers: [
        { key: "Authorization", value: "Bearer 1" },
        { key: "X-Custom", value: "abc" },
        { key: "", value: "" },
      ],
    });

    const keyInputs = screen.getAllByPlaceholderText("Header-Name");
    fireEvent.change(keyInputs[0], { target: { value: "X-Auth" } });
    expect(onChange).toHaveBeenCalledWith({
      headers: [
        { key: "X-Auth", value: "Bearer 1" },
        { key: "X-Custom", value: "abc" },
      ],
    });

    const valInputs = screen.getAllByPlaceholderText("Value or {{var}}");
    fireEvent.change(valInputs[1], { target: { value: "xyz" } });
    expect(onChange).toHaveBeenCalledWith({
      headers: [
        { key: "Authorization", value: "Bearer 1" },
        { key: "X-Custom", value: "xyz" },
      ],
    });

    // Remove first header (the icon button next to each header row)
    const allButtons = screen.getAllByRole("button");
    // allButtons[0] is Add Header, allButtons[1] is remove header 0
    fireEvent.click(allButtons[1]);
    expect(onChange).toHaveBeenCalledWith({
      headers: [{ key: "X-Custom", value: "abc" }],
    });

    fireEvent.change(screen.getByLabelText(/JSON \/ Request Body/i), {
      target: { value: '{"b":2}' },
    });
    expect(onChange).toHaveBeenCalledWith({ body: '{"b":2}' });

    fireEvent.change(screen.getByLabelText(/Timeout \(ms\)/i), {
      target: { value: "2000" },
    });
    expect(onChange).toHaveBeenCalledWith({ timeoutMs: 2000 });

    fireEvent.change(screen.getByLabelText(/Timeout \(ms\)/i), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({ timeoutMs: 15000 });

    fireEvent.change(screen.getByTestId("http-method-select"), {
      target: { value: "GET" },
    });
    expect(onChange).toHaveBeenCalledWith({ method: "GET" });

    fireEvent.click(screen.getByRole("switch", { name: /Require Review Gate/i }));
    expect(onChange).toHaveBeenCalledWith({ requiresReview: true });
  });
});
