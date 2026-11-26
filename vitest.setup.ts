import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import "./vitest.setup.node";

// KaTeX's CSS import breaks the Vitest PostCSS pipeline in jsdom; mock globally for test runs
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@xyflow/react/dist/style.css", () => ({}));

if (typeof window !== "undefined") {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (window.HTMLElement) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.setPointerCapture = () => {};
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}
