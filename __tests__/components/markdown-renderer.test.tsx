import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";

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
    expect(container.querySelector("th")).not.toBeNull();
    expect(container.querySelector("td")).not.toBeNull();
  });

  it("renders GFM task lists", () => {
    const { container } = render(
      <MarkdownRenderer content={"- [x] done\n- [ ] todo"} />,
    );
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });
});

describe("MarkdownRenderer typography elements", () => {
  it("renders headings with appropriate hierarchy classes", () => {
    const { container } = render(
      <MarkdownRenderer content={"# Title\n## Section\n### Subsection"} />,
    );
    const h1 = container.querySelector("h1");
    const h2 = container.querySelector("h2");
    const h3 = container.querySelector("h3");

    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe("Title");
    expect(h1?.className).toContain("text-2xl");

    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe("Section");
    expect(h2?.className).toContain("text-xl");

    expect(h3).not.toBeNull();
    expect(h3?.textContent).toBe("Subsection");
    expect(h3?.className).toContain("text-lg");
  });

  it("renders bullet and numbered lists with proper list styles", () => {
    const { container } = render(
      <MarkdownRenderer
        content={"- Item 1\n- Item 2\n\n1. Step 1\n2. Step 2"}
      />,
    );
    const ul = container.querySelector("ul");
    const ol = container.querySelector("ol");

    expect(ul).not.toBeNull();
    expect(ul?.className).toContain("list-disc");
    expect(ul?.querySelectorAll("li").length).toBe(2);

    expect(ol).not.toBeNull();
    expect(ol?.className).toContain("list-decimal");
    expect(ol?.querySelectorAll("li").length).toBe(2);
  });

  it("renders blockquotes and horizontal rules", () => {
    const { container } = render(
      <MarkdownRenderer content={"> Important note\n\n---"} />,
    );
    const blockquote = container.querySelector("blockquote");
    const hr = container.querySelector("hr");

    expect(blockquote).not.toBeNull();
    expect(blockquote?.textContent).toContain("Important note");
    expect(blockquote?.className).toContain("border-l-4");

    expect(hr).not.toBeNull();
    expect(hr?.className).toContain("border-border");
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
    expect(wrapper!.textContent).toContain("js");
  });

  it("supports copying code from fenced code block", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<MarkdownRenderer content={"```python\nprint('hello')\n```"} />);
    const copyButton = screen.getByRole("button", { name: /copy code/i });
    expect(copyButton).not.toBeNull();

    await act(async () => {
      fireEvent.click(copyButton);
    });
    expect(writeTextMock).toHaveBeenCalledWith("print('hello')");
  });

  it("keeps inline code text visible inside a paragraph flow", () => {
    const { container } = render(
      <MarkdownRenderer content="Run `ls -la` to list files." />,
    );
    const p = container.querySelector("p");
    expect(p?.textContent).toContain("Run ls -la to list files.");
  });
});
