import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWriteFile = vi.fn();
const mockBookNew = vi.fn();
const mockAoaToSheet = vi.fn();
const mockJsonToSheet = vi.fn();
const mockBookAppendSheet = vi.fn();

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<any>("xlsx");
  return {
    ...actual,
    utils: {
      ...actual.utils,
      book_new: (...args: any[]) => {
        mockBookNew(...args);
        return actual.utils.book_new(...args);
      },
      aoa_to_sheet: (...args: any[]) => {
        mockAoaToSheet(...args);
        return actual.utils.aoa_to_sheet(...args);
      },
      json_to_sheet: (...args: any[]) => {
        mockJsonToSheet(...args);
        return actual.utils.json_to_sheet(...args);
      },
      book_append_sheet: (...args: any[]) => {
        mockBookAppendSheet(...args);
        return actual.utils.book_append_sheet(...args);
      },
    },
    writeFile: (...args: any[]) => mockWriteFile(...args),
  };
});

import { downloadArtifact } from "@/lib/artifacts/download-artifact";
import type { ArtifactData } from "@/types/artifact/artifact-data";

describe("downloadArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns early if window is undefined or artifact is missing", () => {
    vi.stubGlobal("window", undefined);
    expect(() =>
      downloadArtifact({
        id: "1",
        title: "Test",
        type: "markdown",
        content: "hello",
      }),
    ).not.toThrow();

    vi.unstubAllGlobals();
    expect(() => downloadArtifact(undefined as any)).not.toThrow();
  });

  it("exports multi-sheet spreadsheet artifact as XLSX with cell object unpacking and default sheet name", () => {
    const sheetArtifact: ArtifactData = {
      id: "art-1",
      title: "Q3 Forecast",
      type: "spreadsheet",
      content: JSON.stringify({
        sheets: [
          {
            // Omit name to test fallback "Sheet1"
            data: [
              [{ v: "Month" }, { v: "Amount" }],
              ["July", 1000],
            ],
          },
        ],
      }),
    };

    downloadArtifact(sheetArtifact);

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.anything(),
      "q3_forecast.xlsx",
    );
    expect(mockBookAppendSheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "Sheet1",
    );
  });

  it("exports legacy array-format spreadsheet artifact using json_to_sheet", () => {
    const legacyArtifact: ArtifactData = {
      id: "art-legacy",
      title: "", // test default title fallback "artifact"
      type: "spreadsheet",
      content: JSON.stringify([
        { item: "Apples", qty: 10 },
        { item: "Oranges", qty: 25 },
      ]),
    };

    downloadArtifact(legacyArtifact);

    expect(mockJsonToSheet).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.anything(),
      "artifact.xlsx",
    );
  });

  it("handles malformed JSON in spreadsheet artifact gracefully without throwing", () => {
    const brokenArtifact: ArtifactData = {
      id: "art-broken",
      title: "Broken Sheet",
      type: "spreadsheet",
      content: "{invalid-json",
    };

    expect(() => downloadArtifact(brokenArtifact)).not.toThrow();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("exports markdown artifact as .md file", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const createObjectUrlSpy = vi
      .spyOn(window.URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectUrlSpy = vi
      .spyOn(window.URL, "revokeObjectURL")
      .mockImplementation(() => {});

    const mdArtifact: ArtifactData = {
      id: "art-md",
      title: "Technical Spec",
      type: "markdown",
      content: "# Technical Specification\nDetails here.",
    };

    downloadArtifact(mdArtifact);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-url");
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe("technical_spec.md");
  });

  it("exports HTML artifact as .html file with text/html mimeType", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-html-url");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    const htmlArtifact: ArtifactData = {
      id: "art-html",
      title: "Interactive Widget",
      type: "html",
      content: "<div>Hello World</div>",
    };

    downloadArtifact(htmlArtifact);

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe("interactive_widget.html");
  });

  it("exports Mermaid artifact as .mmd file", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-mermaid-url");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    const mermaidArtifact: ArtifactData = {
      id: "art-mmd",
      title: "Architecture Flow",
      type: "mermaid",
      content: "graph TD\nA-->B",
    };

    downloadArtifact(mermaidArtifact);

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe("architecture_flow.mmd");
  });

  it("exports unknown/other artifact type as .txt file", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-txt-url");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    const otherArtifact: ArtifactData = {
      id: "art-other",
      title: "Plain Notes",
      type: "other" as any,
      content: "Just plain text notes",
    };

    downloadArtifact(otherArtifact);

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe("plain_notes.txt");
  });
});
