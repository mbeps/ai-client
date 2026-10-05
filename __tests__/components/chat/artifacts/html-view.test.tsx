import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HtmlView from "@/components/chat/artifacts/html-view";

describe("HtmlView — iframe sandbox (ART-01)", () => {
  it("does not grant same-origin access to sandboxed content", () => {
    const { container } = render(<HtmlView content="<h1>hi</h1>" />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const sandbox = iframe!.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-same-origin");
    // Scripts must still run for Mermaid/chart rendering
    expect(sandbox).toContain("allow-scripts");
  });
});
