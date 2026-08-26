import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// KaTeX's CSS import breaks the Vitest PostCSS pipeline in jsdom; not needed for assertions
vi.mock("katex/dist/katex.min.css", () => ({}));

import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

describe("MarkdownRenderer XSS sanitisation", () => {
  it("strips script tags", () => {
    const { container } = render(
      <MarkdownRenderer content="<script>alert(1)</script>hello" />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("strips onerror handlers from images", () => {
    const { container } = render(
      <MarkdownRenderer content='<img src=x onerror="alert(1)">' />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("onerror")).toBeNull();
  });

  it("strips javascript: hrefs", () => {
    const { container } = render(
      <MarkdownRenderer content='<a href="javascript:alert(1)">x</a>' />,
    );
    const anchor = container.querySelector("a");
    const href = anchor?.getAttribute("href");
    expect(href === null || !href.includes("javascript:")).toBe(true);
  });
});

describe("MarkdownRenderer rich content survives sanitisation", () => {
  it("renders KaTeX math", () => {
    const { container } = render(<MarkdownRenderer content="$E=mc^2$" />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
  });

  it("renders GFM tables", () => {
    const { container } = render(
      <MarkdownRenderer content={"| a | b |\n| - | - |\n| 1 | 2 |"} />,
    );
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("renders GFM task lists", () => {
    const { container } = render(
      <MarkdownRenderer content={"- [x] done\n- [ ] todo"} />,
    );
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });
});

describe("MarkdownRenderer inline vs block code (react-markdown v10)", () => {
  it("renders inline code WITHOUT the block wrapper", () => {
    const { container } = render(
      <MarkdownRenderer content="Use `npm install` here." />,
    );
    const code = container.querySelector("code");
    expect(code?.textContent).toBe("npm install");
    // No block wrapper ancestor
    expect(code!.closest("pre")).toBeNull();
    expect(code!.closest("div.relative")).toBeNull();
  });

  it("renders fenced blocks WITH the block wrapper and keeps text visible", () => {
    const { container } = render(
      <MarkdownRenderer content={"```js\nconsole.log(1);\n```"} />,
    );
    const wrapper = container.querySelector("div.relative");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector("pre")).not.toBeNull();
    expect(wrapper!.textContent).toContain("console.log(1);");
  });

  it("keeps inline code text visible inside a paragraph flow", () => {
    const { container } = render(
      <MarkdownRenderer content="Run `ls -la` to list files." />,
    );
    const p = container.querySelector("p");
    expect(p?.textContent).toContain("Run ls -la to list files.");
  });
});
